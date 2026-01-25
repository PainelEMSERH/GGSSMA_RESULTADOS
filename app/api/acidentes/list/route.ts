export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const unidade = url.searchParams.get('unidade') || '';
    const tipo = url.searchParams.get('tipo') || '';
    const status = url.searchParams.get('status') || '';
    const empresa = url.searchParams.get('empresa') || '';
    const ano = url.searchParams.get('ano') || String(new Date().getFullYear());
    const mes = url.searchParams.get('mes') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '25', 10);
    const q = url.searchParams.get('q') || '';

    const where: any = {
      ano: parseInt(ano, 10),
    };

    if (regional) {
      where.regional = regional;
    }

    if (unidade) {
      where.unidadeHospitalar = { contains: unidade, mode: 'insensitive' };
    }

    if (tipo) {
      where.tipo = tipo;
    }

    if (status) {
      where.status = status;
    }

    if (empresa) {
      where.empresa = empresa;
    }

    if (mes) {
      where.mes = parseInt(mes, 10);
    }

    if (q) {
      where.OR = [
        { nome: { contains: q, mode: 'insensitive' } },
        { unidadeHospitalar: { contains: q, mode: 'insensitive' } },
        { numeroCAT: { contains: q, mode: 'insensitive' } },
        { riat: { contains: q, mode: 'insensitive' } },
        { sinan: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.acidente.findMany({
        where,
        orderBy: { data: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.acidente.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      rows,
      total,
      page,
      pageSize,
    });
  } catch (e: any) {
    console.error('[acidentes/list] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
