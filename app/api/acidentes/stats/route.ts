export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

    // Total de acidentes no ano
    const totalAno = await prisma.acidente.count({ where });

    // Total de acidentes no mês atual
    const mesAtual = new Date().getMonth() + 1;
    const totalMes = await prisma.acidente.count({
      where: { ...where, mes: mesAtual },
    });

    // Por regional
    const porRegional = await prisma.acidente.groupBy({
      by: ['regional'],
      where,
      _count: true,
    });

    // Por tipo
    const porTipo = await prisma.acidente.groupBy({
      by: ['tipo'],
      where,
      _count: true,
    });

    // Por unidade
    const porUnidade = await prisma.acidente.groupBy({
      by: ['unidadeHospitalar'],
      where,
      _count: true,
      orderBy: { _count: { unidadeHospitalar: 'desc' } },
      take: 20,
    });

    // Por mês (todos os meses do ano)
    const porMes: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      const count = await prisma.acidente.count({
        where: { ...where, mes: m },
      });
      porMes[String(m).padStart(2, '0')] = count;
    }

    // Por status
    const porStatus = await prisma.acidente.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    // Com e sem afastamento
    const comAfastamento = await prisma.acidente.count({
      where: { ...where, comAfastamento: true },
    });
    const semAfastamento = await prisma.acidente.count({
      where: { ...where, comAfastamento: false },
    });

    return NextResponse.json({
      ok: true,
      totalAno,
      totalMes,
      porRegional: porRegional.map((r) => ({
        regional: r.regional || 'Não informado',
        quantidade: r._count,
      })),
      porTipo: porTipo.map((t) => ({
        tipo: t.tipo,
        quantidade: t._count,
      })),
      porUnidade: porUnidade.map((u) => ({
        unidade: u.unidadeHospitalar,
        quantidade: u._count,
      })),
      porMes,
      porStatus: porStatus.map((s) => ({
        status: s.status,
        quantidade: s._count,
      })),
      comAfastamento,
      semAfastamento,
    });
  } catch (e: any) {
    console.error('[acidentes/stats] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
