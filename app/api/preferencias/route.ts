export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export type PreferenciasPayload = {
  regionalPadrao?: string | null;
  unidadePadrao?: string | null;
  itensPorPagina?: number | null;
};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const pref = await prisma.preferenciaUsuario.findUnique({
      where: { clerkUserId: userId },
    });

    return NextResponse.json({
      ok: true,
      preferencias: pref
        ? {
            regionalPadrao: pref.regionalPadrao ?? null,
            unidadePadrao: pref.unidadePadrao ?? null,
            itensPorPagina: pref.itensPorPagina ?? null,
          }
        : { regionalPadrao: null, unidadePadrao: null, itensPorPagina: null },
    });
  } catch (e: any) {
    console.error('[preferencias/GET]', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const body = (await req.json()) as PreferenciasPayload;
    const regionalPadrao =
      body.regionalPadrao === '' || body.regionalPadrao === undefined
        ? null
        : String(body.regionalPadrao || '').trim() || null;
    const unidadePadrao =
      body.unidadePadrao === '' || body.unidadePadrao === undefined
        ? null
        : String(body.unidadePadrao || '').trim() || null;
    const itensPorPagina =
      body.itensPorPagina === undefined || body.itensPorPagina === null
        ? null
        : [25, 50, 100].includes(Number(body.itensPorPagina))
        ? Number(body.itensPorPagina)
        : null;

    const pref = await prisma.preferenciaUsuario.upsert({
      where: { clerkUserId: userId },
      create: {
        clerkUserId: userId,
        regionalPadrao,
        unidadePadrao,
        itensPorPagina,
      },
      update: {
        regionalPadrao,
        unidadePadrao,
        itensPorPagina,
      },
    });

    return NextResponse.json({
      ok: true,
      preferencias: {
        regionalPadrao: pref.regionalPadrao ?? null,
        unidadePadrao: pref.unidadePadrao ?? null,
        itensPorPagina: pref.itensPorPagina ?? null,
      },
    });
  } catch (e: any) {
    console.error('[preferencias/POST]', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
