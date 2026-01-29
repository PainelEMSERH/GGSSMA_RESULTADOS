export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

/** GET ?ano=2026 — retorna ativos por mês (1–12). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ano = parseInt(url.searchParams.get('ano') || String(new Date().getFullYear()), 10);

    const registros = await prisma.ativosMensal.findMany({
      where: { ano },
      orderBy: { mes: 'asc' },
    });

    const porMes: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) porMes[String(m).padStart(2, '0')] = 0;
    for (const r of registros) {
      if (r.mes >= 1 && r.mes <= 12) {
        porMes[String(r.mes).padStart(2, '0')] = r.ativos;
      }
    }

    return NextResponse.json({ ok: true, registros, porMes });
  } catch (e: any) {
    console.error('[acidentes/ativos-mensal GET]', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/** POST — upsert ativos por mês. body: { ano, registros: [ { mes, ativos } ] } */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const ano = parseInt(body.ano, 10);
    const registros = Array.isArray(body.registros) ? body.registros : [];

    if (!ano || ano < 2000 || ano > 2100) {
      return NextResponse.json(
        { ok: false, error: 'Ano inválido' },
        { status: 400 }
      );
    }

    for (const item of registros) {
      const mes = parseInt(item.mes, 10);
      const ativos = parseInt(item.ativos, 10);
      if (mes < 1 || mes > 12 || ativos < 0) continue;

      await prisma.ativosMensal.upsert({
        where: {
          ativos_ano_mes: { ano, mes },
        },
        update: { ativos },
        create: { ano, mes, ativos },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[acidentes/ativos-mensal POST]', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
