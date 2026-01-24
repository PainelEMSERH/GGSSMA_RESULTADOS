
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const epiMapUnits = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT unidade_hospitalar 
      FROM stg_epi_map 
      ORDER BY unidade_hospitalar ASC
    `);

    const unidRegUnits = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT nmdepartamento 
      FROM stg_unid_reg 
      ORDER BY nmdepartamento ASC
    `).catch(() => []);

    return NextResponse.json({
      ok: true,
      epi_map: epiMapUnits.map(u => u.unidade_hospitalar),
      unid_reg: unidRegUnits.map(u => u.nmdepartamento),
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
