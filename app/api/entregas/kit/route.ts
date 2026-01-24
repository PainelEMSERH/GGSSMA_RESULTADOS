
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findBestUnitMatch } from '@/lib/unitMatcher';
import { findBestFunctionMatch } from '@/lib/functionMatcher';

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

    // Resolve a melhor função usando Matcher Inteligente (Alias, Motorista, etc)
    let finalFuncKey = funcKey;
    let targetFuncName = funcaoRaw; // Nome da função para buscar no banco
    try {
      const allFunctionsRaw = await prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT COALESCE(funcao_normalizada, alterdata_funcao) AS func_name 
        FROM stg_epi_map 
        WHERE alterdata_funcao IS NOT NULL
      `);
      const allFunctions = allFunctionsRaw.map(f => f.func_name).filter(Boolean);
      
      const matchedFunc = findBestFunctionMatch(funcaoRaw, allFunctions);
      if (matchedFunc) {
        targetFuncName = matchedFunc;
        finalFuncKey = normFuncKey(matchedFunc);
        if (finalFuncKey !== funcKey) {
          console.log(`[Kit API] Match de função: "${funcaoRaw}" -> "${matchedFunc}"`);
        }
      }
    } catch (err) {
      console.warn('[Kit API] Erro ao buscar lista de funções para match:', err);
    }

    // Busca unidade correspondente (se houver)
    // PRIORIDADE: Busca primeiro nas unidades do EPI Map, depois no Alterdata
    let matchedUnit: string | null = null;
    if (unidadeRaw) {
      try {
        // 1. Busca unidades do EPI Map (prioridade)
        const epiUnits = await prisma.$queryRawUnsafe<any[]>(`
          SELECT DISTINCT unidade_hospitalar FROM stg_epi_map 
          WHERE unidade_hospitalar IS NOT NULL 
            AND TRIM(unidade_hospitalar) != ''
            AND unidade_hospitalar != 'PCG UNIVERSAL'
            AND unidade_hospitalar != 'SEM MAPEAMENTO NO PCG'
        `);
        const epiUnitList = epiUnits.map(u => u.unidade_hospitalar).filter(Boolean);
        matchedUnit = findBestUnitMatch(unidadeRaw, epiUnitList);
        
        // 2. Se não encontrou no EPI Map, busca no Alterdata e tenta mapear
        if (!matchedUnit) {
          const alterdataUnits = await prisma.$queryRawUnsafe<any[]>(`
            SELECT DISTINCT TRIM(unidade_hospitalar) as unidade
            FROM stg_alterdata_v2
            WHERE unidade_hospitalar IS NOT NULL 
              AND TRIM(unidade_hospitalar) != ''
          `);
          const alterdataUnitList = alterdataUnits.map(u => u.unidade).filter(Boolean);
          const matchedAlterdata = findBestUnitMatch(unidadeRaw, alterdataUnitList);
          
          // Se encontrou no Alterdata, tenta mapear para o EPI Map
          if (matchedAlterdata) {
            matchedUnit = findBestUnitMatch(matchedAlterdata, epiUnitList);
            if (matchedUnit) {
              console.log(`[Kit API] Match de unidade (via Alterdata): "${unidadeRaw}" -> "${matchedAlterdata}" -> "${matchedUnit}"`);
            }
          }
        }
        
        if (matchedUnit) {
          console.log(`[Kit API] Match de unidade: "${unidadeRaw}" -> "${matchedUnit}"`);
        } else {
          console.log(`[Kit API] Nenhum match de unidade encontrado para: "${unidadeRaw}"`);
        }
      } catch (e) {
        console.warn('[Kit API] Erro ao buscar unidades:', e);
      }
    }

    // Busca kits usando a NOVA estrutura
    // Prioridade:
    // 1. Função normalizada + Unidade específica
    // 2. Função normalizada + PCG UNIVERSAL
    // 3. Função alterdata + Unidade específica
    // 4. Função alterdata + PCG UNIVERSAL
    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      SELECT
        COALESCE(funcao_normalizada, alterdata_funcao, '') AS func_normalizada,
        COALESCE(alterdata_funcao, '') AS func_alterdata,
        COALESCE(epi_item, '') AS item,
        COALESCE(quantidade::numeric, 0) AS qtd,
        COALESCE(pcg, '') AS pcg,
        COALESCE(unidade_hospitalar, '') AS unidade_hosp
      FROM stg_epi_map
      WHERE (
        UPPER(TRIM(COALESCE(funcao_normalizada, ''))) = UPPER(TRIM('${targetFuncName.replace(/'/g, "''")}'))
        OR UPPER(TRIM(COALESCE(alterdata_funcao, ''))) = UPPER(TRIM('${funcaoRaw.replace(/'/g, "''")}'))
      )
      `
    );

    // Filtra e prioriza os resultados
    const porUnidadeEspecifica: KitRow[] = [];
    const porPcgUniversal: KitRow[] = [];
    const porUnidadeGenerica: KitRow[] = [];

    for (const r of rows) {
      const itemName = String(r.item || '').trim();
      if (!itemName || itemName.toUpperCase() === 'SEM EPI') continue; // Ignora "SEM EPI"

      const qtd = Number(r.qtd || 0);
      if (qtd <= 0) continue; // Ignora quantidade zero

      const pcg = String(r.pcg || '').trim();
      const unidadeHosp = String(r.unidade_hosp || '').trim();
      const funcNorm = String(r.func_normalizada || '').trim();
      const funcAlt = String(r.func_alterdata || '').trim();

      // Verifica se a função bate (prioriza normalizada)
      const funcMatch = 
        (funcNorm && normFuncKey(funcNorm) === finalFuncKey) ||
        (funcAlt && normFuncKey(funcAlt) === finalFuncKey);
      
      if (!funcMatch) continue;

      const base: KitRow = {
        item: itemName,
        quantidade: qtd,
        nome_site: null,
      };

      // Determina se é PCG UNIVERSAL baseado na coluna pcg
      const isPcgUniversal = pcg === 'PCG UNIVERSAL';
      const isSemMapeamento = pcg === 'SEM MAPEAMENTO NO PCG';
      
      // Prioridade 1: Unidade específica (se unidade foi informada e bate)
      // IMPORTANTE: Só usa PCG UNIVERSAL se NÃO encontrar pela unidade_hospitalar
      if (matchedUnit && unidadeHosp && !isPcgUniversal && !isSemMapeamento && 
          normUnidKey(unidadeHosp) === normUnidKey(matchedUnit)) {
        porUnidadeEspecifica.push(base);
      }
      // Prioridade 2: Outra unidade (genérico, mas não universal) - antes do PCG UNIVERSAL
      else if (unidadeHosp && !isPcgUniversal && !isSemMapeamento && 
               unidadeHosp !== 'PCG UNIVERSAL' && unidadeHosp !== 'SEM MAPEAMENTO NO PCG') {
        porUnidadeGenerica.push(base);
      }
      // Prioridade 3: PCG UNIVERSAL (fallback global) - só se não encontrou por unidade
      else if (isPcgUniversal) {
        porPcgUniversal.push(base);
      }
    }

    // Escolhe a fonte conforme prioridade
    // ORDEM: Unidade específica > Outra unidade > PCG UNIVERSAL
    let fonte: KitRow[];
    if (porUnidadeEspecifica.length > 0) {
      fonte = porUnidadeEspecifica;
      console.log(`[Kit API] Usando kit específico da unidade "${matchedUnit}" (${porUnidadeEspecifica.length} itens)`);
    } else if (porUnidadeGenerica.length > 0) {
      fonte = porUnidadeGenerica;
      console.log(`[Kit API] Usando kit genérico de outra unidade (${porUnidadeGenerica.length} itens)`);
    } else if (porPcgUniversal.length > 0) {
      fonte = porPcgUniversal;
      console.log(`[Kit API] Usando kit PCG UNIVERSAL (fallback) (${porPcgUniversal.length} itens)`);
    } else {
      fonte = [];
      console.log(`[Kit API] Nenhum kit encontrado para "${funcaoRaw}"`);
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

