export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isEpiObrigatorio } from '@/data/epiObrigatorio';

/**
 * Calcula a meta de EPIs obrigatórios por regional
 * Meta = soma de todos os EPIs obrigatórios dos colaboradores ativos da regional
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const unidade = url.searchParams.get('unidade') || '';

    if (!regional) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Regional é obrigatória',
        meta: 0 
      });
    }

    // Busca colaboradores ativos da regional/unidade
    const wh: string[] = [];
    const regTrim = regional.trim();
    const uniTrim = unidade.trim();

    // Verifica se stg_unid_reg existe
    const hasUnidReg: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `);
    const useJoin = hasUnidReg?.[0]?.exists;

    if (regTrim && useJoin) {
      wh.push(`(UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${regTrim.replace(/'/g, "''")}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
        SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${regTrim.replace(/'/g, "''")}'))
      ))`);
    }
    
    if (uniTrim) {
      if (useJoin) {
        wh.push(`(UPPER(TRIM(COALESCE(u.nmdepartamento, a.unidade_hospitalar, ''))) = UPPER(TRIM('${uniTrim.replace(/'/g, "''")}')) OR UPPER(TRIM(a.unidade_hospitalar)) = UPPER(TRIM('${uniTrim.replace(/'/g, "''")}')))`);
      } else {
        wh.push(`UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${uniTrim.replace(/'/g, "''")}'))`);
      }
    }

    // Filtro de demissão: apenas demitidos antes de 2026-01-01 são removidos
    const DEMISSAO_LIMITE = '2026-01-01';
    wh.push(`(a.demissao IS NULL OR a.demissao = '' OR TRIM(a.demissao) = '' OR a.demissao::text >= '${DEMISSAO_LIMITE}')`);

    const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';

    // Busca TODOS os colaboradores (sem GROUP BY - mantém duplicatas se CPF aparecer 2x)
    const sql = useJoin ? `
      SELECT 
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.funcao, '') AS funcao,
        COALESCE(a.unidade_hospitalar, '') AS unidade_hospitalar
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      ${whereSql}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    ` : `
      SELECT 
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.funcao, '') AS funcao,
        COALESCE(a.unidade_hospitalar, '') AS unidade_hospitalar
      FROM stg_alterdata_v2 a
      ${whereSql}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    `;

    const colaboradores = await prisma.$queryRawUnsafe<any[]>(sql);
    console.log(`[Meta API] Colaboradores encontrados: ${colaboradores.length} (pode ter CPFs duplicados se demitido e voltou em 2026)`);

    // Busca kits de stg_epi_map (mesma fonte do botão "Entregar")
    let kitRows: any[] = [];
    try {
      kitRows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COALESCE(alterdata_funcao::text, '') AS funcao,
          COALESCE(nome_site::text, '') AS site,
          COALESCE(epi_item::text, '') AS item,
          COALESCE(quantidade::numeric, 1) AS qtd
        FROM stg_epi_map
      `);
      console.log(`[Meta API] Kits encontrados em stg_epi_map: ${kitRows.length}`);
    } catch (mapError: any) {
      console.error('[Meta API] Erro ao buscar de stg_epi_map:', mapError?.message || mapError);
      return NextResponse.json({
        ok: false,
        error: `Erro ao buscar kits: ${String(mapError)}`,
        meta: 0,
      });
    }

    // Funções auxiliares (mesmas do /api/entregas/kit)
    function normKey(s: any): string {
      return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    }
    
    function normFuncKey(s: any): string {
      const raw = (s ?? '').toString();
      const cleaned = raw.replace(/\(A\)/gi, '').replace(/\s+/g, ' ');
      return normKey(cleaned);
    }
    
    function normUnidKey(s: any): string {
      const raw = (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const withoutStops = raw.replace(/\b(hospital|hosp|de|da|das|do|dos)\b/g, ' ');
      return withoutStops.replace(/[^a-z0-9]/gi, '');
    }

    // Cache de kits por função+unidade (para performance)
    const kitCache = new Map<string, number>(); // chave: "funcaoKey|unidadeKey" -> soma de itens obrigatórios
    let totalMeta = 0;

    // Para cada colaborador (mesmo CPF pode aparecer 2x se demitido e voltou em 2026)
    for (const colab of colaboradores) {
      const funcao = String(colab.funcao || '').trim();
      const unidadeHosp = String(colab.unidade_hospitalar || '').trim();
      
      if (!funcao) continue;
      
      const funcKey = normFuncKey(funcao);
      const unidadeKey = normUnidKey(unidadeHosp);
      const cacheKey = `${funcKey}|${unidadeKey}`;
      
      // Busca soma do kit (usa cache)
      let somaKit = 0;
      if (kitCache.has(cacheKey)) {
        somaKit = kitCache.get(cacheKey)!;
      } else {
        // Busca kit da função (mesma lógica do /api/entregas/kit)
        const all: Array<{ item: string; qtd: number }> = [];
        const genericos: Array<{ item: string; qtd: number }> = [];
        const porUnidade: Array<{ item: string; qtd: number }> = [];
        
        for (const r of kitRows) {
          const rFuncKey = normFuncKey(r.funcao);
          if (rFuncKey !== funcKey) continue;
          
          const item = String(r.item || '').trim();
          if (!item || !isEpiObrigatorio(item)) continue; // Apenas obrigatórios
          
          const qtd = Number(r.qtd || 1) || 1;
          const site = String(r.site || '').trim();
          const siteKey = site ? normUnidKey(site) : '';
          
          const itemData = { item, qtd };
          all.push(itemData);
          
          if (!siteKey) {
            genericos.push(itemData);
          } else if (unidadeKey && siteKey === unidadeKey) {
            porUnidade.push(itemData);
          }
        }
        
        // Prioriza: por unidade > genérico > todos (mesma lógica do /api/entregas/kit)
        let fonte: Array<{ item: string; qtd: number }> = [];
        if (porUnidade.length > 0) {
          fonte = porUnidade;
        } else if (genericos.length > 0) {
          fonte = genericos;
        } else {
          fonte = all;
        }
        
        // Remove duplicatas de item (pega maior quantidade)
        const byItem = new Map<string, number>();
        for (const itemData of fonte) {
          const itemKey = normKey(itemData.item);
          const existing = byItem.get(itemKey);
          if (!existing || itemData.qtd > existing) {
            byItem.set(itemKey, itemData.qtd);
          }
        }
        
        // Soma todos os itens obrigatórios do kit
        somaKit = Array.from(byItem.values()).reduce((acc, qtd) => acc + qtd, 0);
        kitCache.set(cacheKey, somaKit);
      }
      
      // Adiciona à meta (conta cada linha, mesmo se CPF duplicado)
      totalMeta += somaKit;
    }
    
    console.log(`[Meta API] Meta calculada: ${totalMeta} itens para ${colaboradores.length} colaboradores`);

    return NextResponse.json({
      ok: true,
      meta: totalMeta,
      colaboradores: colaboradores.length,
      regional: regTrim,
      unidade: uniTrim || null,
    });
  } catch (e: any) {
    console.error('Erro ao calcular meta:', e);
    return NextResponse.json({
      ok: false,
      error: String(e?.message || e),
      meta: 0,
    });
  }
}
