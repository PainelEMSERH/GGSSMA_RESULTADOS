
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type KitRow = { item: string; quantidade: number; nome_site: string | null };

function normKey(s: any): string {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function normFuncKey(s: any): string {
  const raw = (s ?? '').toString();
  const cleaned = raw.replace(/\(A\)/gi, '').replace(/\s+/g, ' ');
  return normKey(cleaned);
}

function normUnidKey(s: any): string {
  const raw = (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const withoutStops = raw.replace(/\b(hospital|hosp|de|da|das|do|dos)\b/g, ' ');
  return withoutStops.replace(/[^a-z0-9]/gi, '');
}


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const funcaoRaw = (searchParams.get('funcao') || '').trim();
  const unidadeRaw = (searchParams.get('unidade') || '').trim();

  if (!funcaoRaw) {
    return NextResponse.json(
      { ok: false, error: 'função inválida' },
      { status: 400 },
    );
  }

  try {
    const funcKey = normFuncKey(funcaoRaw);
    const unidadeKey = unidadeRaw ? normUnidKey(unidadeRaw) : '';

    if (!funcKey) {
      return NextResponse.json({ ok: true, items: [] });
    }

    // Busca PCG da unidade hospitalar
    const UNIDADE_FALLBACK_PCG = 'HOSPITAL DA ILHA';
    let pcgUnidade: string | null = null;
    let pcgHospitalIlha: string | null = null;
    
    // Busca PCG do HOSPITAL DA ILHA (sempre necessário para fallback)
    try {
      let fallbackResult: any[] = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT COALESCE(codigo_alterdata::text, '') AS pcg
        FROM stg_epi_map
        WHERE UPPER(TRIM(COALESCE(unidade_hospitalar, ''))) = UPPER(TRIM('${UNIDADE_FALLBACK_PCG.replace(/'/g, "''")}'))
          AND COALESCE(codigo_alterdata, '') != ''
        LIMIT 1
      `);
      
      // Se não achar exato, tenta com LIKE
      if (!fallbackResult.length) {
        console.log('[Kit API] Fallback exato não encontrado, tentando LIKE...');
        fallbackResult = await prisma.$queryRawUnsafe(`
          SELECT DISTINCT COALESCE(codigo_alterdata::text, '') AS pcg
          FROM stg_epi_map
          WHERE UPPER(TRIM(COALESCE(unidade_hospitalar, ''))) LIKE '%HOSPITAL DA ILHA%'
            AND COALESCE(codigo_alterdata, '') != ''
          LIMIT 1
        `);
      }
      
      // Rede de segurança: Se ainda não achou Hospital da Ilha, pega QUALQUER Hospital (exceto SVO)
      if (!fallbackResult.length) {
        console.log('[Kit API] Fallback Hospital da Ilha não encontrado, tentando qualquer HOSPITAL...');
        fallbackResult = await prisma.$queryRawUnsafe(`
          SELECT DISTINCT COALESCE(codigo_alterdata::text, '') AS pcg
          FROM stg_epi_map
          WHERE UPPER(TRIM(COALESCE(unidade_hospitalar, ''))) LIKE '%HOSPITAL%'
            AND UPPER(TRIM(COALESCE(unidade_hospitalar, ''))) NOT LIKE '%SVO%'
            AND UPPER(TRIM(COALESCE(unidade_hospitalar, ''))) NOT LIKE '%VERIFICA%'
            AND COALESCE(codigo_alterdata, '') != ''
          LIMIT 1
        `);
      }

      if (fallbackResult.length > 0 && fallbackResult[0].pcg) {
        pcgHospitalIlha = String(fallbackResult[0].pcg).trim();
        console.log(`[Kit API] PCG do Hospital da Ilha encontrado: ${pcgHospitalIlha}`);
      } else {
        console.warn('[Kit API] CRÍTICO: PCG do Hospital da Ilha NÃO encontrado nem com LIKE.');
      }
    } catch (e) {
      console.warn('[Kit API] Erro ao buscar PCG de HOSPITAL DA ILHA:', e);
    }

    // Busca PCG da unidade solicitada
    if (unidadeRaw) {
      try {
        const pcgResult: any[] = await prisma.$queryRawUnsafe(`
          SELECT DISTINCT COALESCE(codigo_alterdata::text, '') AS pcg
          FROM stg_epi_map
          WHERE UPPER(TRIM(COALESCE(unidade_hospitalar, ''))) = UPPER(TRIM('${unidadeRaw.replace(/'/g, "''")}'))
            AND COALESCE(codigo_alterdata, '') != ''
          LIMIT 1
        `);
        if (pcgResult.length > 0 && pcgResult[0].pcg) {
          pcgUnidade = String(pcgResult[0].pcg).trim();
          console.log(`[Kit API] PCG encontrado para unidade ${unidadeRaw}: ${pcgUnidade}`);
        }
      } catch (pcgError) {
        console.warn('[Kit API] Erro ao buscar PCG da unidade:', pcgError);
      }
    }
    
    // Define o PCG alvo: da unidade ou o fallback (Hospital da Ilha)
    const targetPcg = pcgUnidade || pcgHospitalIlha;
    
    console.log(`[Kit API] Unidade: "${unidadeRaw}", PCG Unidade: ${pcgUnidade}, PCG Fallback: ${pcgHospitalIlha}, Target: ${targetPcg}`);

    // Busca todos os kits da função (com PCG)
    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      SELECT
        COALESCE(codigo_alterdata::text, '') AS pcg,
        COALESCE(alterdata_funcao::text, '') AS func,
        COALESCE(nome_site::text, '')        AS site,
        COALESCE(unidade_hospitalar::text, '') AS unidade_hosp,
        COALESCE(epi_item::text, '')         AS item,
        COALESCE(quantidade::numeric, 1)     AS qtd
      FROM stg_epi_map
      `
    );

    // Prioridade 1: Função + PCG alvo + unidade específica
    const porUnidadeComPcg: KitRow[] = [];
    // Prioridade 2: Função + PCG alvo (genérico do PCG)
    const porPcgGenerico: KitRow[] = [];
    // Prioridade 3: Função + PCG Hospital da Ilha (se diferente do alvo)
    const porPcgFallback: KitRow[] = [];

    for (const r of rows) {
      const fKey = normFuncKey(r.func);
      if (!fKey || fKey !== funcKey) continue;

      const itemName = String(r.item || '').trim();
      if (!itemName) continue;

      const qtd = Number(r.qtd || 1) || 1;
      const pcg = String(r.pcg || '').trim();
      const site = String(r.site || '').trim();
      const unidadeHosp = String(r.unidade_hosp || '').trim();
      const siteKey = site ? normUnidKey(site) : '';
      const unidadeHospKey = unidadeHosp ? normUnidKey(unidadeHosp) : '';

      const base: KitRow = {
        item: itemName,
        quantidade: qtd,
        nome_site: site || null,
      };

      // Prioridade 1: PCG alvo + unidade específica
      if (targetPcg && pcg === targetPcg && unidadeKey && (siteKey === unidadeKey || unidadeHospKey === unidadeKey)) {
        porUnidadeComPcg.push(base);
      }
      // Prioridade 2: PCG alvo (genérico)
      else if (targetPcg && pcg === targetPcg) {
        porPcgGenerico.push(base);
      }
      // Prioridade 3: PCG Hospital da Ilha (fallback se função não existir no alvo)
      else if (pcgHospitalIlha && pcg === pcgHospitalIlha && pcg !== targetPcg) {
        porPcgFallback.push(base);
      }
    }

    // Escolhe a fonte conforme prioridade
    let fonte: KitRow[];
    if (porUnidadeComPcg.length > 0) {
      fonte = porUnidadeComPcg;
      console.log(`[Kit API] Usando kit específico da unidade com PCG ${targetPcg} (${porUnidadeComPcg.length} itens)`);
    } else if (porPcgGenerico.length > 0) {
      fonte = porPcgGenerico;
      console.log(`[Kit API] Usando kit genérico do PCG ${targetPcg} (${porPcgGenerico.length} itens)`);
    } else if (porPcgFallback.length > 0) {
      fonte = porPcgFallback;
      console.log(`[Kit API] Usando kit fallback do PCG ${pcgHospitalIlha} (${porPcgFallback.length} itens)`);
    } else {
      fonte = [];
    }

    // Remove duplicatas de item (pega maior quantidade)
    const byItem = new Map<string, KitRow>();

    for (const base of fonte) {
      const itemKey = normKey(base.item);
      const existing = byItem.get(itemKey);
      if (!existing) {
        byItem.set(itemKey, { ...base });
      } else {
        if (base.quantidade > existing.quantidade) {
          existing.quantidade = base.quantidade;
        }
        if (!existing.nome_site && base.nome_site) {
          existing.nome_site = base.nome_site;
        }
      }
    }

    const items = Array.from(byItem.values()).sort((a, b) =>
      a.item.localeCompare(b.item, 'pt-BR')
    );

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    console.error('Error in /api/entregas/kit', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'erro' },
      { status: 500 },
    );
  }
}

