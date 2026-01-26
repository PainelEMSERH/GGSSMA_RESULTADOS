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
 * Calcula o status de um extintor em uma data específica
 * @param dataRecarga Data da última recarga
 * @param dataReferencia Data de referência para calcular o status
 * @param periodoMeses Período legal em meses (padrão: 12)
 * @returns 'VENCIDO' se estava vencido naquela data, 'OK' caso contrário
 */
function calcularStatusNaData(
  dataRecarga: Date | null,
  dataReferencia: Date,
  periodoMeses: number = 12
): 'VENCIDO' | 'OK' {
  if (!dataRecarga) {
    return 'VENCIDO'; // Sem data de recarga = vencido
  }

  // Calcula data limite: última recarga + período
  const dataLimite = new Date(dataRecarga);
  dataLimite.setMonth(dataLimite.getMonth() + periodoMeses);
  dataLimite.setHours(23, 59, 59, 999);

  // Se a data de referência é posterior à data limite, está vencido
  return dataReferencia > dataLimite ? 'VENCIDO' : 'OK';
}

/**
 * API para Meta e Real de Extintores SPCI
 * Meta = 0 (zero extintores vencidos) - todos deveriam estar OK
 * Real = quantidade de extintores vencidos em cada mês do ano
 * 
 * Lógica: Para cada mês do ano, verifica quantos extintores estavam vencidos
 * naquele mês (considerando o último dia do mês como referência)
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

    // Meta sempre é 0 (zero extintores vencidos) - todos deveriam estar OK
    const meta = 0;

    // Real: quantidade de extintores vencidos em cada mês do ano
    // Para cada mês, verifica quantos extintores estavam vencidos no último dia daquele mês
    const meses: Record<string, number> = {
      '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
      '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0,
    };

    const anoAtual = parseInt(ano, 10);
    let processados = 0;
    let semDataRecarga = 0;

    // Para cada extintor
    for (const row of rows) {
      // Usa Data Execução Recarga se existir, senão usa Última recarga
      const dataRecargaStr = row['Data Execução Recarga'] || row['Última recarga'];
      if (!dataRecargaStr) {
        semDataRecarga++;
        // Sem data de recarga = considerado vencido em todos os meses
        for (let mes = 1; mes <= 12; mes++) {
          const mesStr = String(mes).padStart(2, '0');
          meses[mesStr]++;
        }
        continue;
      }

      const dataRecarga = parseDateBR(dataRecargaStr);
      if (!dataRecarga) {
        semDataRecarga++;
        // Data inválida = considerado vencido em todos os meses
        for (let mes = 1; mes <= 12; mes++) {
          const mesStr = String(mes).padStart(2, '0');
          meses[mesStr]++;
        }
        continue;
      }

      // Para cada mês do ano, verifica se o extintor estava vencido no último dia daquele mês
      for (let mes = 1; mes <= 12; mes++) {
        // Último dia do mês como data de referência
        // new Date(ano, mes, 0) retorna o último dia do mês anterior
        // então new Date(ano, mes+1, 0) retorna o último dia do mês atual
        const dataReferencia = new Date(anoAtual, mes, 0, 23, 59, 59, 999);
        
        const status = calcularStatusNaData(dataRecarga, dataReferencia, 12);
        if (status === 'VENCIDO') {
          const mesStr = String(mes).padStart(2, '0');
          meses[mesStr]++;
        }
      }
      processados++;
    }

    console.log(`[spci/meta-real] Resultado: ${processados} extintores processados, ${semDataRecarga} sem data de recarga`);

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
