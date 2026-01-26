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
 *        Baseado na data da última recarga + 12 meses = data de vencimento
 *        Se vence em janeiro, conta na meta de janeiro
 *        Meta acumulada: Jan tem os que vencem em jan, Fev tem jan+fev, Mar tem jan+fev+mar, etc.
 * 
 * REAL = quantidade acumulada de extintores que FORAM REALMENTE recarregados até cada mês
 *        Baseado no campo "Data Execução Recarga"
 *        Real acumulado: Jan tem os recarregados em jan, Fev tem jan+fev, Mar tem jan+fev+mar, etc.
 * 
 * Exemplo:
 * - Extintor recarregado em 15/01/2025 → vence em 15/01/2026 → conta na META de janeiro/2026
 * - Se 50 foram recarregados em janeiro e 30 em fevereiro:
 *   REAL Janeiro: 50, REAL Fevereiro: 80 (50+30), REAL Março: 80 (se nenhum em março)
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

    // META: Conta extintores que vencem em cada mês (baseado em última recarga + 12 meses)
    const metaMeses: Record<string, number> = {
      '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
      '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0,
    };

    // REAL: Conta extintores recarregados em cada mês
    const realMeses: Record<string, number> = {
      '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
      '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0,
    };

    let processados = 0;
    let recarregadosNoAno = 0;
    let semDataRecarga = 0;
    let vencidosSemData = 0;
    let vencemEmOutroAno = 0;

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
          } else if (dataVencimento.getFullYear() < anoAtual) {
            // Já vencido antes de 2026 → precisa recarregar no início de janeiro (ano começa devendo)
            metaMeses['01']++;
            vencemEmOutroAno++;
          }
          // Se vence depois de 2026, não precisa recarregar em 2026, então não entra na meta
        } else {
          // Data inválida → sem data de recarga → vencido
          semDataRecarga++;
          vencidosSemData++;
          // Conta como urgente em janeiro
          metaMeses['01']++;
        }
      } else {
        // Sem data de recarga → vencido
        semDataRecarga++;
        vencidosSemData++;
        // Conta como urgente em janeiro
        metaMeses['01']++;
      }

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

    // Calcula META acumulada mês a mês
    const metaAcumulada: Record<string, number> = {
      '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
      '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0,
    };
    let acumuladoMeta = 0;
    for (let mes = 1; mes <= 12; mes++) {
      const mesStr = String(mes).padStart(2, '0');
      acumuladoMeta += metaMeses[mesStr] || 0;
      metaAcumulada[mesStr] = acumuladoMeta;
    }

    // Calcula REAL acumulado mês a mês
    const realAcumulado: Record<string, number> = {
      '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
      '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0,
    };
    let acumuladoReal = 0;
    for (let mes = 1; mes <= 12; mes++) {
      const mesStr = String(mes).padStart(2, '0');
      acumuladoReal += realMeses[mesStr] || 0;
      realAcumulado[mesStr] = acumuladoReal;
    }

    console.log(`[spci/meta-real] Resultado: ${processados} extintores processados, ${recarregadosNoAno} recarregados no ano ${anoAtual}`);
    console.log(`[spci/meta-real] - ${semDataRecarga} sem data de recarga (vencidos, contados em janeiro)`);
    console.log(`[spci/meta-real] - ${vencemEmOutroAno} vencidos antes de ${anoAtual} (contados em janeiro)`);
    console.log(`[spci/meta-real] Meta por mês (vencimentos):`, metaMeses);
    console.log(`[spci/meta-real] Meta acumulada por mês:`, metaAcumulada);
    console.log(`[spci/meta-real] Real por mês:`, realMeses);
    console.log(`[spci/meta-real] Real acumulado por mês:`, realAcumulado);

    const totalMeta = metaAcumulada['12']; // Dezembro = meta acumulada total
    const totalReal = acumuladoReal;

    return NextResponse.json({
      ok: true,
      meta: metaAcumulada, // Retorna meta acumulada para exibição
      metaMensal: metaMeses, // Meta por mês (sem acumular) para referência
      real: realMeses, // Real por mês (sem acumular) para referência
      realAcumulado: realAcumulado, // Real acumulado para exibição
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
