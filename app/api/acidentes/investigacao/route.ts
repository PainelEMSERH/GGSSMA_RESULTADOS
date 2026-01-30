export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

/** GET ?ref=numeroCAT|data|nome — retorna investigação do acidente */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const url = new URL(req.url);
    const ref = url.searchParams.get('ref')?.trim();
    if (!ref) {
      return NextResponse.json({ ok: false, error: 'Parâmetro ref é obrigatório' }, { status: 400 });
    }

    const inv = await prisma.acidenteInvestigacao.findUnique({
      where: { acidenteRef: ref },
    });

    return NextResponse.json({ ok: true, investigacao: inv ?? null });
  } catch (e: any) {
    console.error('[acidentes/investigacao GET]', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

/** POST — cria ou atualiza investigação (body: acidenteRef, numeroCAT?, statusInvestigacao, riatUrl, riatNome, catUrl, catNome, sinanUrl, sinanNome, observacoes) */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const acidenteRef = body.acidenteRef?.trim();
    if (!acidenteRef) {
      return NextResponse.json({ ok: false, error: 'acidenteRef é obrigatório' }, { status: 400 });
    }

    const data = {
      numeroCAT: body.numeroCAT?.trim() || null,
      regional: body.regional?.trim() || null,
      tipo: body.tipo?.trim() || null,
      statusInvestigacao: body.statusInvestigacao?.trim() || null,
      riatUrl: body.riatUrl?.trim() || null,
      riatNome: body.riatNome?.trim() || null,
      catUrl: body.catUrl?.trim() || null,
      catNome: body.catNome?.trim() || null,
      sinanUrl: body.sinanUrl?.trim() || null,
      sinanNome: body.sinanNome?.trim() || null,
      observacoes: body.observacoes?.trim() || null,
    };

    const inv = await prisma.acidenteInvestigacao.upsert({
      where: { acidenteRef },
      create: { acidenteRef, ...data },
      update: data,
    });

    return NextResponse.json({ ok: true, investigacao: inv });
  } catch (e: any) {
    console.error('[acidentes/investigacao POST]', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
