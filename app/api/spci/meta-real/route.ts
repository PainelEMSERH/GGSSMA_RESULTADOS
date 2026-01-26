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
 *        (baseado no campo "Planej. Recarga")
 * 
 * REAL = quantidade de extintores que FORAM REALMENTE recarregados em cada mês
 *        (baseado no campo "Data Execução Recarga")
 * 
 * Exemplo:
 * - Em janeiro, se 40 extintores têm "Planej. Recarga" = janeiro, então META = 40
 * - Em janeiro, se 25 extintores têm "Data Execução Recarga" = janeiro, então REAL = 25
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

    // Busca todos os extintores com dados de planejamento e execução
    const rowsSql = `
      SELECT 
        id,
        "Planej. Recarga",
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
    let semPlanejamento = 0;
    let semExecucao = 0;

    // Para cada extintor
    for (const row of rows) {
      processados++;

      // META: Conta extintores com "Planej. Recarga" em cada mês do ano
      const planejRecargaStr = row['Planej. Recarga'];
      if (planejRecargaStr) {
        const planejRecarga = parseDateBR(planejRecargaStr);
        if (planejRecarga && planejRecarga.getFullYear() === anoAtual) {
          const mesPlanej = String(planejRecarga.getMonth() + 1).padStart(2, '0');
          if (metaMeses[mesPlanej] !== undefined) {
            metaMeses[mesPlanej]++;
          }
        }
      } else {
        semPlanejamento++;
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
      } else {
        semExecucao++;
      }
    }

    console.log(`[spci/meta-real] Resultado: ${processados} extintores processados`);
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
