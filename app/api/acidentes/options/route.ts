export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const regionais = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT NULLIF(TRIM(COALESCE("Regional",'')),'') AS regional
      FROM stg_acidentes
      WHERE COALESCE("Regional",'') != ''
      ORDER BY 1
    `);

    const unidades = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT
        COALESCE(nmdepartamento,'') AS unidade,
        COALESCE("Regional",'') AS regional
      FROM stg_acidentes
      WHERE COALESCE(nmdepartamento,'') != ''
      ORDER BY 1
    `);

    return NextResponse.json({
      ok: true,
      regionais: (regionais || [])
        .map((r) => String(r.regional || '').trim())
        .filter(Boolean)
        .sort(),
      unidades: (unidades || []).map((u) => ({
        unidade: String(u.unidade || '').trim(),
        regional: String(u.regional || '').trim(),
      })),
    });
  } catch (e: any) {
    console.error('[acidentes/options] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
