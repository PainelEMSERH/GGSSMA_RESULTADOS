export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    // A partir de agora, Acidentes é SOMENTE LEITURA, vindo de CSV (stg_acidentes) no Neon.
    // Removemos lançamento manual.
    return NextResponse.json(
      { ok: false, error: 'Acidentes agora são somente leitura (importados pela planilha).' },
      { status: 405 }
    );
  } catch (e: any) {
    console.error('[acidentes/save] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
