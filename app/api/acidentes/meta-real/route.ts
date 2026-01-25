export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * API para Meta e Real de Acidentes
 * Meta = 0 (zero acidentes)
 * Real = quantidade de acidentes por mês
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const ano = url.searchParams.get('ano') || String(new Date().getFullYear());

    const where: any = {
      ano: parseInt(ano, 10),
    };

    if (regional) {
      where.regional = regional;
    }

    // Meta sempre é 0 (zero acidentes)
    const meta = 0;

    // Real: quantidade de acidentes por mês
    const meses: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      const count = await prisma.acidente.count({
        where: { ...where, mes: m },
      });
      meses[String(m).padStart(2, '0')] = count;
    }

    const total = Object.values(meses).reduce((acc, val) => acc + val, 0);

    return NextResponse.json({
      ok: true,
      meta,
      real: meses,
      total,
      ano: parseInt(ano, 10),
    });
  } catch (e: any) {
    console.error('[acidentes/meta-real] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
