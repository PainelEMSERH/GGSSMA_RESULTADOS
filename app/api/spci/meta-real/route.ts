import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calcularStatus, parseDateBR } from '@/lib/spci/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Função auxiliar para converter BigInt para Number (para serialização JSON)
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }
  
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToNumber(value);
    }
    return converted;
  }
  
  return obj;
}

/**
 * API para Meta e Real de Extintores SPCI
 * 
 * META = quantidade de extintores que DEVERIAM ser recarregados em cada mês
 *        Calculado automaticamente: última recarga + 12 meses = data de vencimento
 *        Se a data de vencimento cai em janeiro/2026, então META de janeiro = +1
 * 
 * REAL = quantidade de extintores que FORAM REALMENTE recarregados em cada mês
 *        Baseado no campo "Data Execução Recarga"
 * 
 * Exemplo:
 * - Extintor com última recarga em 01/01/2025 → vencimento em 01/01/2026
 *   → META de janeiro/2026 = +1
 * - Se foi recarregado em 15/01/2026 → REAL de janeiro/2026 = +1
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const ano = url.searchParams.get('ano') || String(new Date().getFullYear());

    // Constrói WHERE clause
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (regional) {
      queryParams.push(regional);
      whereConditions.push(`"Regional" = $${paramIndex}`);
      paramIndex++;
    }

    const whereSql = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Busca todos os extintores com dados de recarga
    const rowsSql = `
      SELECT 
        id,
        "Última recarga",
        "Data Execução Recarga"
      FROM spci_planilha
      ${whereSql}
    `;

    let rows: any[];
    if (queryParams.length > 0) {
      rows = await prisma.$queryRawUnsafe<any[]>(rowsSql, ...queryParams);
    } else {
      rows = await prisma.$queryRawUnsafe<any[]>(rowsSql);
    }
    
    // Converte BigInt para Number para evitar erro de serialização
    rows = convertBigIntToNumber(rows);

    console.log(`[spci/meta-real] Processando ${rows.length} extintores para ano ${ano}, regional: ${regional || 'todas'}`);

    const anoAtual = parseInt(ano, 10);

    // Inicializa contadores para META e REAL por mês
    const metaMeses: Record<string, number> = {
      '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
      '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0,
    };

    const realMeses: Record<string, number> = {
      '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
      '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0,
    };

    let processados = 0;
    let semDataRecarga = 0;

    // Para cada extintor
    for (const row of rows) {
      processados++;

      // META: Calcula quando o extintor precisa ser recarregado (última recarga + 12 meses)
      // Usa "Data Execução Recarga" se existir (pois é a recarga mais recente), senão usa "Última recarga"
      const dataRecargaStr = row['Data Execução Recarga'] || row['Última recarga'];
      
      if (dataRecargaStr) {
        const dataRecarga = parseDateBR(dataRecargaStr);
        if (dataRecarga) {
          // Calcula data de vencimento: última recarga + 12 meses
          const dataVencimento = new Date(dataRecarga);
          dataVencimento.setMonth(dataVencimento.getMonth() + 12);
          
          // Se o vencimento cai no ano especificado, conta na META do mês correspondente
          if (dataVencimento.getFullYear() === anoAtual) {
            const mesVencimento = String(dataVencimento.getMonth() + 1).padStart(2, '0');
            if (metaMeses[mesVencimento] !== undefined) {
              metaMeses[mesVencimento]++;
            }
          }
        } else {
          semDataRecarga++;
        }
      } else {
        semDataRecarga++;
        // Sem data de recarga = precisa recarregar urgentemente, conta em todos os meses
        for (let mes = 1; mes <= 12; mes++) {
          const mesStr = String(mes).padStart(2, '0');
          metaMeses[mesStr]++;
        }
      }

      // REAL: Conta extintores com "Data Execução Recarga" em cada mês do ano
      const dataExecRecargaStr = row['Data Execução Recarga'];
      if (dataExecRecargaStr) {
        const dataExecRecarga = parseDateBR(dataExecRecargaStr);
        if (dataExecRecarga && dataExecRecarga.getFullYear() === anoAtual) {
          const mesExec = String(dataExecRecarga.getMonth() + 1).padStart(2, '0');
          if (realMeses[mesExec] !== undefined) {
            realMeses[mesExec]++;
          }
        }
      }
    }

    console.log(`[spci/meta-real] Resultado: ${processados} extintores processados, ${semDataRecarga} sem data de recarga`);
    console.log(`[spci/meta-real] Meta por mês:`, metaMeses);
    console.log(`[spci/meta-real] Real por mês:`, realMeses);

    const totalMeta = Object.values(metaMeses).reduce((acc, val) => acc + val, 0);
    const totalReal = Object.values(realMeses).reduce((acc, val) => acc + val, 0);

    return NextResponse.json({
      ok: true,
      meta: metaMeses,
      real: realMeses,
      totalMeta,
      totalReal,
      ano: anoAtual,
    });
  } catch (e: any) {
    console.error('[spci/meta-real] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
