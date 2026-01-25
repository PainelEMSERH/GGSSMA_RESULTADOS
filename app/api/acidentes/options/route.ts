export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    // Busca regionais únicas
    const regionais = await prisma.acidente.findMany({
      select: { regional: true },
      distinct: ['regional'],
      where: { regional: { not: null } },
    });

    // Busca unidades únicas
    const unidades = await prisma.acidente.findMany({
      select: { unidadeHospitalar: true, regional: true },
      distinct: ['unidadeHospitalar'],
    });

    return NextResponse.json({
      ok: true,
      regionais: regionais
        .map((r) => r.regional)
        .filter((r): r is string => r !== null)
        .sort(),
      unidades: unidades.map((u) => ({
        unidade: u.unidadeHospitalar,
        regional: u.regional || '',
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
