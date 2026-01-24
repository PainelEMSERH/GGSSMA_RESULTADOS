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

    // Busca colaboradores e seus kits esperados (agrupa por CPF para evitar duplicatas)
    const sql = useJoin ? `
      SELECT 
        COALESCE(a.cpf, '') AS cpf,
        MAX(COALESCE(a.funcao, '')) AS funcao
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      ${whereSql}
      AND COALESCE(a.cpf, '') != ''
      GROUP BY COALESCE(a.cpf, '')
    ` : `
      SELECT 
        COALESCE(a.cpf, '') AS cpf,
        MAX(COALESCE(a.funcao, '')) AS funcao
      FROM stg_alterdata_v2 a
      ${whereSql}
      AND COALESCE(a.cpf, '') != ''
      GROUP BY COALESCE(a.cpf, '')
    `;

    const colaboradores = await prisma.$queryRawUnsafe<any[]>(sql);
    console.log(`[Meta API] Colaboradores únicos encontrados: ${colaboradores.length}`);

    // Busca kits esperados por função (apenas EPIs obrigatórios)
    let totalMeta = 0;

    try {
      // Busca kits da tabela stg_epi_map (mais confiável que a view)
      let kitRows: any[] = [];
      try {
        kitRows = await prisma.$queryRawUnsafe<any[]>(`
          SELECT
            COALESCE(alterdata_funcao::text, '') AS funcao,
            COALESCE(epi_item::text, '') AS item,
            COALESCE(quantidade::numeric, 0) AS qtd
          FROM stg_epi_map
        `);
        console.log(`[Meta API] Kits encontrados em stg_epi_map: ${kitRows.length}`);
      } catch (mapError: any) {
        console.error('[Meta API] Erro ao buscar de stg_epi_map:', mapError?.message || mapError);
        // Tenta buscar da view como fallback
        try {
          kitRows = await prisma.$queryRaw<any[]>`
            SELECT
              COALESCE(cpf::text, '') AS cpf,
              COALESCE(epi_nome::text, '') AS item,
              COALESCE(quantidade::numeric, 0) AS qtd
            FROM vw_entregas_epi_unidade
          `;
          console.log(`[Meta API] Kits encontrados na view: ${kitRows.length}`);
        } catch (viewError: any) {
          console.error('[Meta API] Erro ao buscar da view também:', viewError?.message || viewError);
        }
      }

      // Mapa de função -> kit (para evitar buscar múltiplas vezes e duplicar)
      const kitPorFuncao = new Map<string, Array<{ item: string; qtd: number }>>();
      const cpfsProcessados = new Set<string>();
      
      // Para cada colaborador, busca seu kit baseado na função (apenas uma vez por CPF)
      for (const colab of colaboradores) {
        const cpf = String(colab.cpf || '').replace(/\D/g, '').slice(-11);
        const funcao = String(colab.funcao || '').trim();
        
        // Evita processar o mesmo CPF duas vezes (pode ter duplicatas)
        if (cpf && cpfsProcessados.has(cpf)) continue;
        if (cpf) cpfsProcessados.add(cpf);
        
        if (!funcao) continue;

        // Busca kit da função (usa cache)
        let kitColab: Array<{ item: string; qtd: number }> = [];
        if (kitPorFuncao.has(funcao)) {
          kitColab = kitPorFuncao.get(funcao)!;
        } else {
          // Busca kit do colaborador pela função (apenas obrigatórios)
          kitColab = kitRows
            .filter((r: any) => {
              const rFuncao = String(r.funcao || '').trim();
              const item = String(r.item || '').trim();
              // Se tem cpf na resposta, compara por cpf; senão compara por função
              if (r.cpf) {
                const rCpf = String(r.cpf || '').replace(/\D/g, '').slice(-11);
                return rCpf === cpf && item && isEpiObrigatorio(item);
              } else {
                return rFuncao === funcao && item && isEpiObrigatorio(item);
              }
            })
            .map((r: any) => ({
              item: String(r.item || '').trim(),
              qtd: Number(r.qtd || 0)
            }));
          
          kitPorFuncao.set(funcao, kitColab);
        }

        // Soma quantidade de EPIs obrigatórios (uma vez por colaborador)
        for (const item of kitColab) {
          if (item.qtd > 0) {
            totalMeta += item.qtd;
          }
        }
      }
      
      console.log(`[Meta API] Meta calculada: ${totalMeta} para ${colaboradores.length} colaboradores`);
    } catch (kitError) {
      console.error('[Meta API] Erro ao buscar kits:', kitError);
      // Se não conseguir buscar kits, retorna 0 mas ainda retorna ok: true
    }

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
