export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isEpiObrigatorio } from '@/data/epiObrigatorio';
import { findBestUnitMatch } from '@/lib/unitMatcher';
import { findBestFunctionMatch } from '@/lib/functionMatcher';

/**
 * Retorna resumo de EPIs por tipo (previsto, entregue, pendente) para uma regional
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const ano = parseInt(url.searchParams.get('ano') || '2026', 10);

    if (!regional) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Regional é obrigatória',
        resumo: []
      });
    }

    // Verifica se stg_unid_reg existe
    const hasUnidReg: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `);
    const useJoin = hasUnidReg?.[0]?.exists;

    if (!useJoin) {
      return NextResponse.json({
        ok: false,
        error: 'Tabela stg_unid_reg não encontrada',
        resumo: []
      });
    }

    const regTrim = regional.trim();
    // Só considera cadastro ATIVO: demissão em branco (não conta pessoa já demitida)
    const DEMISSAO_WHERE = `(a.demissao IS NULL OR a.demissao = '' OR TRIM(a.demissao) = '')`;

    // Busca colaboradores da regional
    const colaboradoresSql = `
      SELECT DISTINCT
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.funcao, '') AS funcao,
        COALESCE(NULLIF(TRIM(u.nmdepartamento), ''), NULLIF(TRIM(a.unidade_hospitalar), ''), '') AS unidade_hospitalar
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      WHERE (UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${regTrim.replace(/'/g, "''")}')) 
             OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
               SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${regTrim.replace(/'/g, "''")}'))
             ))
        AND ${DEMISSAO_WHERE}
        AND COALESCE(a.cpf, '') != ''
        AND COALESCE(a.funcao, '') != ''
    `;

    let colaboradores = await prisma.$queryRawUnsafe<any[]>(colaboradoresSql);

    // Filtra colaboradores marcados como "fora da meta"
    try {
      const cpfsList = colaboradores.map(c => String(c.cpf || '').replace(/\D/g, '').slice(-11)).filter(c => c.length === 11);
      if (cpfsList.length > 0) {
        const situacoesResult = await prisma.$queryRawUnsafe<any[]>(`
          SELECT cpf, situacao
          FROM colaborador_situacao_meta
          WHERE cpf = ANY($1::text[])
            AND situacao IN ('DEMITIDO_2026_SEM_EPI', 'DEMITIDO_2025_SEM_EPI', 'EXCLUIDO_META')
        `, cpfsList);
        
        const cpfsForaMeta = new Set(situacoesResult.map(r => r.cpf));
        if (cpfsForaMeta.size > 0) {
          colaboradores = colaboradores.filter(c => {
            const cpfLimpo = String(c.cpf || '').replace(/\D/g, '').slice(-11);
            return !cpfsForaMeta.has(cpfLimpo);
          });
        }
      }
    } catch (e) {
      console.warn('[Resumo EPIs] Erro ao filtrar colaboradores fora da meta:', e);
    }

    // Busca kits de stg_epi_map
    const kitRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COALESCE(pcg, '') AS pcg,
        COALESCE(alterdata_funcao, '') AS funcao,
        COALESCE(funcao_normalizada, alterdata_funcao, '') AS funcao_norm,
        COALESCE(unidade_hospitalar, '') AS unidade_hosp,
        COALESCE(epi_item, '') AS item,
        COALESCE(quantidade::numeric, 1) AS qtd
      FROM stg_epi_map
    `);

    // Busca entregas da regional
    const cpfs = colaboradores.map(c => String(c.cpf || '').replace(/\D/g, '').slice(-11)).filter(c => c.length === 11);
    let entregas: any[] = [];
    if (cpfs.length > 0) {
      const entregasSql = `
        SELECT
          regexp_replace(COALESCE(TRIM(cpf), ''), '[^0-9]', '', 'g') AS cpf,
          COALESCE(item::text, '') AS item,
          COALESCE(deliveries::jsonb, '[]'::jsonb) AS deliveries
        FROM epi_entregas
        WHERE regexp_replace(COALESCE(TRIM(cpf), ''), '[^0-9]', '', 'g') = ANY($1::text[])
      `;
      entregas = await prisma.$queryRawUnsafe<any[]>(entregasSql, cpfs);
    }

    // Funções auxiliares
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

    // Mapa de EPIs previstos por tipo
    const previstosPorTipo = new Map<string, number>();
    
    // Busca todas as funções do mapa
    const allFunctionsList = Array.from(new Set(kitRows.map(r => r.funcao).filter(Boolean)));

    // Para cada colaborador, calcula os EPIs previstos
    for (const colab of colaboradores) {
      const funcao = String(colab.funcao || '').trim();
      const unidadeHosp = String(colab.unidade_hospitalar || '').trim();
      
      if (!funcao) continue;
      
      const funcKey = normFuncKey(funcao);
      const unidadeKey = normUnidKey(unidadeHosp);
      
      // Resolve a melhor função
      let finalFuncKey = funcKey;
      if (allFunctionsList.length > 0) {
        const matchedFunc = findBestFunctionMatch(funcao, allFunctionsList);
        if (matchedFunc) {
          finalFuncKey = normFuncKey(matchedFunc);
        }
      }
      
      // Busca kit da função
      const porUnidadeEspecifica: Array<{ item: string; qtd: number }> = [];
      const porPcgUniversal: Array<{ item: string; qtd: number }> = [];
      
      for (const r of kitRows) {
        const rFuncKey = normFuncKey(r.funcao);
        if (rFuncKey !== finalFuncKey) continue;
        
        const item = String(r.item || '').trim();
        if (!item || item.toUpperCase() === 'SEM EPI' || !isEpiObrigatorio(item)) continue;
        
        const qtd = Number(r.qtd || 1) || 1;
        const pcg = String(r.pcg || '').trim();
        const unidadeHospMap = String(r.unidade_hosp || '').trim();
        
        const isPcgUniversal = pcg === 'PCG UNIVERSAL';
        const isSemMapeamento = pcg === 'SEM MAPEAMENTO NO PCG';
        const pcgIsUnitName = !isPcgUniversal && !isSemMapeamento && pcg && pcg.trim() !== '';
        
        if (unidadeKey) {
          const unidadeHospMatch = unidadeHospMap && normUnidKey(unidadeHospMap) === unidadeKey;
          const pcgMatch = pcgIsUnitName && normUnidKey(pcg) === unidadeKey;
          
          if ((unidadeHospMatch || pcgMatch) && !isPcgUniversal && !isSemMapeamento) {
            porUnidadeEspecifica.push({ item, qtd });
            continue;
          }
        }
        
        if (isPcgUniversal && (!unidadeHospMap || unidadeHospMap === '' || unidadeHospMap === 'PCG UNIVERSAL')) {
          porPcgUniversal.push({ item, qtd });
        }
      }
      
      const fonte = porUnidadeEspecifica.length > 0 ? porUnidadeEspecifica : porPcgUniversal;
      
      // Remove duplicatas
      const byItem = new Map<string, number>();
      for (const itemData of fonte) {
        const itemKey = normKey(itemData.item);
        const existing = byItem.get(itemKey);
        if (!existing || itemData.qtd > existing) {
          byItem.set(itemKey, itemData.qtd);
        }
      }
      
      // Adiciona ao mapa de previstos
      for (const [itemKey, qtd] of byItem.entries()) {
        // Busca o nome original do item
        const itemOriginal = fonte.find(i => normKey(i.item) === itemKey)?.item || itemKey;
        const current = previstosPorTipo.get(itemOriginal) || 0;
        previstosPorTipo.set(itemOriginal, current + qtd);
      }
    }

    // Mapa de EPIs entregues por tipo
    const entreguesPorTipo = new Map<string, number>();
    
    for (const entrega of entregas) {
      const item = String(entrega.item || '').trim();
      if (!item || !isEpiObrigatorio(item)) continue;
      
      const deliveries = Array.isArray(entrega.deliveries) ? entrega.deliveries : [];
      
      for (const del of deliveries) {
        if (!del.date || !del.qty) continue;
        
        const dateStr = String(del.date).substring(0, 10);
        const [year] = dateStr.split('-');
        
        if (parseInt(year, 10) === ano) {
          const qty = Number(del.qty || 0);
          if (qty > 0) {
            const current = entreguesPorTipo.get(item) || 0;
            entreguesPorTipo.set(item, current + qty);
          }
        }
      }
    }

    // Monta resumo
    const todosItens = new Set([...previstosPorTipo.keys(), ...entreguesPorTipo.keys()]);
    const resumo = Array.from(todosItens)
      .map(item => {
        const previsto = previstosPorTipo.get(item) || 0;
        const entregue = entreguesPorTipo.get(item) || 0;
        const pendente = Math.max(0, previsto - entregue);
        
        return {
          item,
          previsto,
          entregue,
          pendente,
        };
      })
      .filter(r => r.previsto > 0) // Apenas itens que têm previsão
      .sort((a, b) => {
        // Ordena por pendente (maior primeiro), depois por nome
        if (b.pendente !== a.pendente) return b.pendente - a.pendente;
        return a.item.localeCompare(b.item);
      });

    return NextResponse.json({
      ok: true,
      resumo,
      ano,
    });
  } catch (e: any) {
    console.error('Erro ao calcular resumo de EPIs por tipo:', e);
    return NextResponse.json({
      ok: false,
      error: String(e?.message || e),
      resumo: [],
    });
  }
}
