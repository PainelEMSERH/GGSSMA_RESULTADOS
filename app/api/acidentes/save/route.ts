export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const user = await currentUser();
    const body = await req.json();

    const {
      id,
      nome,
      empresa,
      unidadeHospitalar,
      regional,
      tipo,
      comAfastamento,
      data,
      hora,
      numeroCAT,
      riat,
      sinan,
      status,
      descricao,
    } = body;

    // Validações
    if (!nome || !nome.trim()) {
      return NextResponse.json({ ok: false, error: 'Nome é obrigatório' }, { status: 400 });
    }
    if (!empresa) {
      return NextResponse.json({ ok: false, error: 'Empresa é obrigatória' }, { status: 400 });
    }
    if (!unidadeHospitalar || !unidadeHospitalar.trim()) {
      return NextResponse.json({ ok: false, error: 'Unidade Hospitalar é obrigatória' }, { status: 400 });
    }
    if (!tipo) {
      return NextResponse.json({ ok: false, error: 'Tipo é obrigatório' }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: 'Data é obrigatória' }, { status: 400 });
    }
    if (!descricao || !descricao.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Descrição detalhada do acidente é obrigatória' },
        { status: 400 },
      );
    }

    const dataObj = new Date(data);
    const mes = dataObj.getMonth() + 1;
    const ano = dataObj.getFullYear();

    const dataAcidente = {
      nome: nome.trim(),
      empresa,
      unidadeHospitalar: unidadeHospitalar.trim(),
      regional: regional || null,
      tipo,
      comAfastamento: Boolean(comAfastamento),
      data: dataObj,
      hora: hora || null,
      mes,
      ano,
      numeroCAT: numeroCAT?.trim() || null,
      riat: riat?.trim() || null,
      sinan: sinan?.trim() || null,
      status: status || 'aberto',
      descricao: descricao?.trim() || null,
      criadoPor: user?.id || userId,
    };

    let acidente;
    if (id) {
      // Atualizar
      acidente = await prisma.acidente.update({
        where: { id },
        data: dataAcidente,
      });
    } else {
      // Criar
      acidente = await prisma.acidente.create({
        data: dataAcidente,
      });
    }

    return NextResponse.json({ ok: true, acidente });
  } catch (e: any) {
    console.error('[acidentes/save] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
