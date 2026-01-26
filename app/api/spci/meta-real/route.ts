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
 * Meta = 0 (zero extintores vencidos)
 * Real = quantidade de extintores vencidos por mês
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

    // Não filtra por ano do planejamento, pois queremos ver vencimentos do ano especificado
    // independente do ano de planejamento

    const whereSql = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Busca todos os extintores
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

    // Meta sempre é 0 (zero extintores vencidos)
    const meta = 0;

    // Real: quantidade de extintores vencidos por mês
    // Para cada extintor, calcula quando ficou vencido baseado na última recarga
    const meses: Record<string, number> = {
      '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
      '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0,
    };

    const anoAtual = parseInt(ano, 10);
    let processados = 0;
    let semDataRecarga = 0;
    let foraDoAno = 0;

    for (const row of rows) {
      // Usa Data Execução Recarga se existir, senão usa Última recarga
      const dataRecargaStr = row['Data Execução Recarga'] || row['Última recarga'];
      if (!dataRecargaStr) {
        semDataRecarga++;
        continue;
      }

      const dataRecarga = parseDateBR(dataRecargaStr);
      if (!dataRecarga) {
        semDataRecarga++;
        continue;
      }

      // Calcula data de vencimento (12 meses após a recarga)
      const dataVencimento = new Date(dataRecarga);
      dataVencimento.setMonth(dataVencimento.getMonth() + 12);
      dataVencimento.setHours(0, 0, 0, 0);

      // Se o vencimento está no ano especificado, conta no mês correspondente
      // Não importa se já venceu ou ainda vai vencer - conta todos que venceram/vencerão naquele mês
      if (dataVencimento.getFullYear() === anoAtual) {
        const mesVencimento = String(dataVencimento.getMonth() + 1).padStart(2, '0');
        if (meses[mesVencimento] !== undefined) {
          meses[mesVencimento]++;
          processados++;
        }
      } else {
        foraDoAno++;
      }
    }

    console.log(`[spci/meta-real] Resultado: ${processados} extintores processados, ${semDataRecarga} sem data de recarga, ${foraDoAno} fora do ano ${anoAtual}`);

    const total = Object.values(meses).reduce((acc, val) => acc + val, 0);

    return NextResponse.json({
      ok: true,
      meta,
      real: meses,
      total,
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
