import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calcularStatus, parsePossuiContrato } from '@/lib/spci/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
 * Retorna estatísticas/resumo dos extintores
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const regional = searchParams.get('regional') || undefined;
    const unidade = searchParams.get('unidade') || undefined;

    // Constrói WHERE clause
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (regional) {
      queryParams.push(regional);
      whereConditions.push(`"Regional" = $${paramIndex}`);
      paramIndex++;
    }

    if (unidade) {
      // Usa busca case-insensitive com TRIM
      queryParams.push(unidade);
      whereConditions.push(`TRIM("Unidade") ILIKE TRIM($${paramIndex})`);
      paramIndex++;
    }

    const whereSql = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Busca todos os registros (para calcular status)
    const rowsSql = `
      SELECT 
        id,
        "TAG",
        "Unidade",
        "Regional",
        "Última recarga",
        "Possui Contrato"
      FROM spci_planilha
      ${whereSql}
    `;

    // Executa query - se não houver filtros, executa sem parâmetros
    let rows: any[];
    if (queryParams.length > 0) {
      rows = await prisma.$queryRawUnsafe<any[]>(rowsSql, ...queryParams);
    } else {
      rows = await prisma.$queryRawUnsafe<any[]>(rowsSql);
    }
    
    // Converte BigInt para Number para evitar erro de serialização
    rows = convertBigIntToNumber(rows);

    // Calcula estatísticas
    let total = 0;
    let totalVencidos = 0;
    let totalAVencer = 0;
    let totalSemContrato = 0;
    const porRegional: Record<string, number> = {};

    for (const row of rows) {
      total++;
      
      // Calcula status
      const calculo = calcularStatus(row['Última recarga']);
      if (calculo.status === 'VENCIDO') totalVencidos++;
      if (calculo.status === 'A VENCER') totalAVencer++;
      
      // Conta sem contrato
      if (!parsePossuiContrato(row['Possui Contrato'])) {
        totalSemContrato++;
      }
      
      // Conta por regional
      const reg = row['Regional'] || 'Sem Regional';
      porRegional[reg] = (porRegional[reg] || 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      stats: {
        total,
        totalVencidos,
        totalAVencer,
        totalSemContrato,
        porRegional,
      },
    });
  } catch (error: any) {
    console.error('spci/stats error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao calcular estatísticas' },
      { status: 500 }
    );
  }
}
