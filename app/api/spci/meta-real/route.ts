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
 * META = quantidade acumulada de extintores que DEVERIAM ser recarregados até cada mês
 *        Calculada como percentual acumulado mês a mês (8.33%, 16.67%, ..., 100%)
 *        Dezembro deve atingir 100% = total de extintores
 *        Exemplo: 1826 extintores → Jan: 152, Fev: 304, ..., Dez: 1826
 * 
 * REAL = quantidade acumulada de extintores que FORAM REALMENTE recarregados até cada mês
 *        Baseado no campo "Data Execução Recarga"
 *        Acumulado mês a mês (se recarregou em março, conta em março, abril, maio, etc.)
 * 
 * Exemplo:
 * - Total: 1826 extintores
 * - META Janeiro: 152 (8.33% de 1826)
 * - META Dezembro: 1826 (100% de 1826)
 * - Se 50 foram recarregados em janeiro e 30 em fevereiro:
 *   REAL Janeiro: 50, REAL Fevereiro: 80 (50+30)
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
    const totalExtintores = rows.length;

    // META: Calculada como percentual acumulado mês a mês (8.33%, 16.67%, ..., 100%)
    // Similar à lógica da página de entregas
    const metaMeses: Record<string, number> = {};
    for (let mes = 1; mes <= 12; mes++) {
      const mesStr = String(mes).padStart(2, '0');
      // Percentual acumulado: (mês / 12) * 100
      const percentualAcumulado = (mes / 12) * 100;
      // Quantidade acumulada de extintores
      metaMeses[mesStr] = Math.round((totalExtintores * percentualAcumulado) / 100);
    }

    // REAL: Conta extintores com "Data Execução Recarga" em cada mês do ano
    const realMeses: Record<string, number> = {
      '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
      '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0,
    };

    // Conta extintores recarregados por mês (acumulado)
    const realAcumulado: Record<string, number> = {
      '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
      '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0,
    };

    let processados = 0;
    let recarregadosNoAno = 0;

    // Para cada extintor
    for (const row of rows) {
      processados++;

      // REAL: Conta extintores com "Data Execução Recarga" em cada mês do ano
      const dataExecRecargaStr = row['Data Execução Recarga'];
      if (dataExecRecargaStr) {
        const dataExecRecarga = parseDateBR(dataExecRecargaStr);
        if (dataExecRecarga && dataExecRecarga.getFullYear() === anoAtual) {
          recarregadosNoAno++;
          const mesExec = String(dataExecRecarga.getMonth() + 1).padStart(2, '0');
          if (realMeses[mesExec] !== undefined) {
            realMeses[mesExec]++;
          }
        }
      }
    }

    // Calcula REAL acumulado mês a mês
    let acumuladoReal = 0;
    for (let mes = 1; mes <= 12; mes++) {
      const mesStr = String(mes).padStart(2, '0');
      acumuladoReal += realMeses[mesStr] || 0;
      realAcumulado[mesStr] = acumuladoReal;
    }

    console.log(`[spci/meta-real] Resultado: ${processados} extintores processados, ${recarregadosNoAno} recarregados no ano ${anoAtual}`);
    console.log(`[spci/meta-real] Meta acumulada por mês:`, metaMeses);
    console.log(`[spci/meta-real] Real por mês:`, realMeses);
    console.log(`[spci/meta-real] Real acumulado por mês:`, realAcumulado);

    const totalMeta = metaMeses['12']; // Dezembro deve ser 100% = total de extintores
    const totalReal = acumuladoReal;

    return NextResponse.json({
      ok: true,
      meta: metaMeses,
      real: realMeses,
      realAcumulado: realAcumulado,
      totalExtintores,
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
