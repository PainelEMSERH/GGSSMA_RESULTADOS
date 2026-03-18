
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
          console.log(`[Kit API] Nenhum match de unidade encontrado para: "${unidadeRaw}" - será usado PCG UNIVERSAL como fallback`);
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
    // REGRA CRÍTICA: Só usa itens da unidade específica OU PCG UNIVERSAL
    // NUNCA mistura itens de unidades diferentes
    const porUnidadeEspecifica: KitRow[] = [];
    const porPcgUniversal: KitRow[] = [];

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

      // Determina se é PCG UNIVERSAL baseado na coluna pcg
      const pcgNorm = pcg
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
      const isPcgUniversal = pcgNorm.includes('PCG UNIVERSAL');
      const isSemMapeamento = pcgNorm.includes('SEM MAPEAMENTO') && pcgNorm.includes('PCG');
      
      // Se pcg tem um nome de unidade (não é PCG UNIVERSAL nem SEM MAPEAMENTO), 
      // então unidade_hospitalar também deve ter esse valor
      // Isso significa que é um kit específico para aquela unidade
      const pcgIsUnitName = !isPcgUniversal && !isSemMapeamento && pcg && pcg.trim() !== '';
      
      // Prioridade 1: Unidade específica (se unidade foi informada e bate EXATAMENTE)
      // Verifica tanto unidade_hospitalar quanto pcg (quando pcg é nome de unidade)
      if (matchedUnit) {
        const unidadeHospMatch = unidadeHosp && normUnidKey(unidadeHosp) === normUnidKey(matchedUnit);
        const pcgMatch = pcgIsUnitName && normUnidKey(pcg) === normUnidKey(matchedUnit);
        
        // SÓ adiciona se bater EXATAMENTE com a unidade do colaborador
        if ((unidadeHospMatch || pcgMatch) && !isPcgUniversal && !isSemMapeamento) {
          porUnidadeEspecifica.push({
            item: itemName,
            quantidade: qtd,
            nome_site: null,
          });
          console.log(`[Kit API] Item "${itemName}" adicionado à unidade específica "${matchedUnit}" (pcg="${pcg}", unidade_hosp="${unidadeHosp}")`);
          continue; // Pula para próximo item, não verifica PCG UNIVERSAL
        } else {
          // Log para debug: por que não entrou na unidade específica
          if (pcgIsUnitName || unidadeHosp) {
            console.log(`[Kit API] Item "${itemName}" IGNORADO - não bate com unidade "${matchedUnit}" (pcg="${pcg}", unidade_hosp="${unidadeHosp}")`);
          }
        }
      }
      
      // Prioridade 2: PCG UNIVERSAL (fallback global) - SÓ se não encontrou unidade específica
      // IMPORTANTE: Só adiciona PCG UNIVERSAL se:
      // 1. É realmente PCG UNIVERSAL (pcg === 'PCG UNIVERSAL')
      // 2. E unidade_hospitalar representa "sem setor específico" (ou vazio)
      // 3. E NÃO encontrou nenhum item de unidade específica (porUnidadeEspecifica.length === 0)
      const unidadeHospNorm = String(unidadeHosp || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      const isSemSetorEspecifico =
        unidadeHospNorm === '' ||
        unidadeHospNorm === 'PCGUNIVERSAL' ||
        unidadeHospNorm.includes('SEMSETOR');

      if (isPcgUniversal && isSemSetorEspecifico) {
        // Só adiciona PCG UNIVERSAL se NÃO encontrou itens de unidade específica
        // Isso garante que não mistura itens de unidades diferentes
        porPcgUniversal.push({
          item: itemName,
          quantidade: qtd,
          nome_site: null,
        });
      }
      // Se não é PCG UNIVERSAL e não bateu com a unidade, IGNORA (não adiciona em lugar nenhum)
    }

    // Escolhe a fonte conforme prioridade
    // ORDEM: Unidade específica > PCG UNIVERSAL
    // NUNCA mistura itens de unidades diferentes
    let fonte: KitRow[];
    if (porUnidadeEspecifica.length > 0) {
      // Se encontrou itens de unidade específica, USA APENAS ELES
      // IGNORA completamente PCG UNIVERSAL para evitar misturar
      fonte = porUnidadeEspecifica;
      console.log(`[Kit API] Usando kit específico da unidade "${matchedUnit}" (${porUnidadeEspecifica.length} itens) - IGNORANDO ${porPcgUniversal.length} itens de PCG UNIVERSAL`);
    } else if (porPcgUniversal.length > 0) {
      // Só usa PCG UNIVERSAL se NÃO encontrou nenhum item de unidade específica
      fonte = porPcgUniversal;
      console.log(`[Kit API] Usando kit PCG UNIVERSAL (fallback) - nenhum item específico encontrado para "${matchedUnit || unidadeRaw || 'N/A'}" (${porPcgUniversal.length} itens)`);
    } else {
      fonte = [];
      console.log(`[Kit API] Nenhum kit encontrado para "${funcaoRaw}" na unidade "${unidadeRaw || 'N/A'}"`);
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

