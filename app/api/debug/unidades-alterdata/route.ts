import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * API para listar todas as unidades do Alterdata e comparar com as do mapeamento
 */
export async function GET() {
  try {
    // Lista unidades únicas do Alterdata
    const unidadesAlterdata = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT 
        TRIM(unidade_hospitalar) as unidade
      FROM stg_alterdata_v2
      WHERE unidade_hospitalar IS NOT NULL 
        AND TRIM(unidade_hospitalar) != ''
      ORDER BY unidade_hospitalar
    `);

    // Lista unidades únicas do mapeamento EPI
    const unidadesMapeamento = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT 
        TRIM(unidade_hospitalar) as unidade
      FROM stg_epi_map
      WHERE unidade_hospitalar IS NOT NULL 
        AND TRIM(unidade_hospitalar) != ''
        AND unidade_hospitalar != 'PCG UNIVERSAL'
        AND unidade_hospitalar != 'SEM MAPEAMENTO NO PCG'
      ORDER BY unidade_hospitalar
    `);

    // Lista também os PCGs do mapeamento
    const pcgsMapeamento = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT 
        TRIM(pcg) as pcg
      FROM stg_epi_map
      WHERE pcg IS NOT NULL 
        AND TRIM(pcg) != ''
        AND pcg != 'PCG UNIVERSAL'
        AND pcg != 'SEM MAPEAMENTO NO PCG'
      ORDER BY pcg
    `);

    return NextResponse.json({
      ok: true,
      unidadesAlterdata: unidadesAlterdata.map((u: any) => u.unidade),
      unidadesMapeamento: unidadesMapeamento.map((u: any) => u.unidade),
      pcgsMapeamento: pcgsMapeamento.map((p: any) => p.pcg),
      totalAlterdata: unidadesAlterdata.length,
      totalMapeamento: unidadesMapeamento.length,
      totalPcgs: pcgsMapeamento.length,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: String(error?.message || error),
    }, { status: 500 });
  }
}
