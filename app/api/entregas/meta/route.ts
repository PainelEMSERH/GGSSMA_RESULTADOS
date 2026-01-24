export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isEpiObrigatorio } from '@/data/epiObrigatorio';
import { findBestUnitMatch } from '@/lib/unitMatcher';

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

    // Busca kits de stg_epi_map (mesma fonte do botão "Entregar") - COM PCG
    let kitRows: any[] = [];
    try {
      kitRows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COALESCE(codigo_alterdata::text, '') AS pcg,
          COALESCE(alterdata_funcao::text, '') AS funcao,
          COALESCE(nome_site::text, '') AS site,
          COALESCE(unidade_hospitalar::text, '') AS unidade_hosp,
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

    const pcgPorUnidade = new Map<string, string | null>();
    let pcgHospitalIlha: string | null = null;
    const unidadesUnicas = new Set<string>();
    for (const colab of colaboradores) {
      const unidadeHosp = String(colab.unidade_hospitalar || '').trim();
      if (unidadeHosp) unidadesUnicas.add(unidadeHosp);
    }
    
    // Busca PCG de todas as unidades de uma vez usando Match Inteligente
    const UNIDADE_FALLBACK_PCG = 'HOSPITAL DA ILHA';
    
    // Busca todas as unidades do mapa para comparar
    let allUnitsList: string[] = [];
    try {
      const allUnits = await prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT unidade_hospitalar FROM stg_epi_map WHERE unidade_hospitalar IS NOT NULL
      `);
      allUnitsList = allUnits.map(u => u.unidade_hospitalar);
    } catch (e) {
      console.warn('[Meta API] Erro ao carregar lista de unidades:', e);
    }

    // Busca PCG do fallback sempre (usando match inteligente)
    try {
      const fallbackUnit = findBestUnitMatch(UNIDADE_FALLBACK_PCG, allUnitsList);
      if (fallbackUnit) {
        const fallback: any[] = await prisma.$queryRawUnsafe(`
          SELECT DISTINCT COALESCE(codigo_alterdata::text, '') AS pcg
          FROM stg_epi_map
          WHERE UPPER(TRIM(COALESCE(unidade_hospitalar, ''))) = UPPER(TRIM('${fallbackUnit.replace(/'/g, "''")}'))
            AND COALESCE(codigo_alterdata, '') != ''
          LIMIT 1
        `);
        if (fallback.length > 0 && fallback[0].pcg) {
          pcgHospitalIlha = String(fallback[0].pcg).trim();
          console.log(`[Meta API] PCG do Hospital da Ilha encontrado: ${pcgHospitalIlha} (${fallbackUnit})`);
        }
      }
    } catch (pcgError) {
      console.warn('[Meta API] Erro ao buscar PCG fallback:', pcgError);
    }

    if (unidadesUnicas.size > 0 && allUnitsList.length > 0) {
      try {
        // Para cada unidade única da lista, encontra o match e busca o PCG
        const matchedUnits = new Set<string>();
        const mapSystemToDbUnit = new Map<string, string>(); // SystemName -> DbName

        for (const systemUnit of Array.from(unidadesUnicas)) {
          const match = findBestUnitMatch(systemUnit, allUnitsList);
          if (match) {
            matchedUnits.add(match);
            mapSystemToDbUnit.set(systemUnit.toUpperCase().trim(), match);
          }
        }

        if (matchedUnits.size > 0) {
          const unidadesListSql = Array.from(matchedUnits).map(u => `'${u.replace(/'/g, "''")}'`).join(',');
          const pcgResults: any[] = await prisma.$queryRawUnsafe(`
            SELECT DISTINCT
              UPPER(TRIM(COALESCE(unidade_hospitalar, ''))) AS unidade,
              COALESCE(codigo_alterdata::text, '') AS pcg
            FROM stg_epi_map
            WHERE UPPER(TRIM(COALESCE(unidade_hospitalar, ''))) IN (${unidadesListSql})
              AND COALESCE(codigo_alterdata, '') != ''
          `);
          
          // Mapeia DB Unit -> PCG
          const dbUnitToPcg = new Map<string, string>();
          for (const r of pcgResults) {
            const unid = String(r.unidade || '').trim();
            const pcg = String(r.pcg || '').trim();
            if (unid && pcg) dbUnitToPcg.set(unid, pcg);
          }

          // Preenche pcgPorUnidade (System Unit -> PCG)
          for (const [sysUnitUpper, dbUnit] of mapSystemToDbUnit.entries()) {
            const pcg = dbUnitToPcg.get(dbUnit.toUpperCase().trim());
            if (pcg) pcgPorUnidade.set(sysUnitUpper, pcg);
          }
        }
      } catch (pcgError) {
        console.warn('[Meta API] Erro ao buscar PCGs das unidades:', pcgError);
      }
    }

    // Cache de kits por função+unidade+PCG (para performance)
    const kitCache = new Map<string, number>(); // chave: "funcaoKey|unidadeKey|pcg" -> soma de itens obrigatórios
    let totalMeta = 0;

    // Para cada colaborador (mesmo CPF pode aparecer 2x se demitido e voltou em 2026)
    for (const colab of colaboradores) {
      const funcao = String(colab.funcao || '').trim();
      const unidadeHosp = String(colab.unidade_hospitalar || '').trim();
      
      if (!funcao) continue;
      
      const funcKey = normFuncKey(funcao);
      const unidadeKey = normUnidKey(unidadeHosp);
      
      // Busca PCG da unidade (usa cache). Se não houver, considera HOSPITAL DA ILHA.
      const unidadeHospUpper = unidadeHosp.toUpperCase().trim();
      const pcgUnidade = pcgPorUnidade.get(unidadeHospUpper);
      const targetPcg = pcgUnidade || pcgHospitalIlha;
      
      const cacheKey = `${funcKey}|${unidadeKey}|${targetPcg || 'null'}`;
      
      // Busca soma do kit (usa cache)
      let somaKit = 0;
      if (kitCache.has(cacheKey)) {
        somaKit = kitCache.get(cacheKey)!;
      } else {
        // Busca kit da função considerando PCG (mesma lógica do /api/entregas/kit)
        // Prioridade 1: Função + PCG alvo + unidade específica
        const porUnidadeComPcg: Array<{ item: string; qtd: number }> = [];
        // Prioridade 2: Função + PCG alvo (genérico do PCG)
        const porPcgGenerico: Array<{ item: string; qtd: number }> = [];
        // Prioridade 3: Função + PCG Hospital da Ilha (se diferente do alvo)
        const porPcgFallback: Array<{ item: string; qtd: number }> = [];
        
        for (const r of kitRows) {
          const rFuncKey = normFuncKey(r.funcao);
          if (rFuncKey !== funcKey) continue;
          
          const item = String(r.item || '').trim();
          if (!item || !isEpiObrigatorio(item)) continue; // Apenas obrigatórios
          
          const qtd = Number(r.qtd || 1) || 1;
          const pcg = String(r.pcg || '').trim();
          const site = String(r.site || '').trim();
          const unidadeHospMap = String(r.unidade_hosp || '').trim();
          const siteKey = site ? normUnidKey(site) : '';
          const unidadeHospKey = unidadeHospMap ? normUnidKey(unidadeHospMap) : '';
          
          const itemData = { item, qtd };
          
          // Prioridade 1: Unidade específica (Ignora PCG, pois a unidade pode ter multiplos PCGs)
          if (unidadeKey && (siteKey === unidadeKey || unidadeHospKey === unidadeKey)) {
            porUnidadeComPcg.push(itemData);
          }
          // Prioridade 2: PCG alvo (genérico, para outras unidades usarem este PCG)
          else if (targetPcg && pcg === targetPcg) {
            porPcgGenerico.push(itemData);
          }
          // Prioridade 3: PCG Hospital da Ilha (fallback)
          else if (pcgHospitalIlha && pcg === pcgHospitalIlha) {
            porPcgFallback.push(itemData);
          }
        }
        
        // Escolhe a fonte conforme prioridade
        let fonte: Array<{ item: string; qtd: number }> = [];
        if (porUnidadeComPcg.length > 0) {
          fonte = porUnidadeComPcg;
        } else if (porPcgGenerico.length > 0) {
          fonte = porPcgGenerico;
        } else if (porPcgFallback.length > 0) {
          fonte = porPcgFallback;
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
