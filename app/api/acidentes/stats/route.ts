export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const ano = url.searchParams.get('ano') || String(new Date().getFullYear());

    const params: any[] = [parseInt(ano, 10)];
    let whereSql = `WHERE ano = $1`;
    if (regional) {
      params.push(regional);
      whereSql += ` AND "Regional" ILIKE $2`;
    }

    const mesAtual = new Date().getMonth() + 1;

    const totalAnoRow = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS total FROM stg_acidentes ${whereSql}`,
      ...params
    );
    const totalMesRow = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS total FROM stg_acidentes ${whereSql} AND mes = $${params.length + 1}`,
      ...params,
      mesAtual
    );

    const porRegionalRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(NULLIF(TRIM("Regional"),''),'Não informado') AS regional, COUNT(*)::int AS quantidade
       FROM stg_acidentes ${whereSql}
       GROUP BY 1
       ORDER BY 2 DESC`,
      ...params
    );

    const porTipoRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(NULLIF(TRIM("Tipo_Acidente"),''),'outros') AS tipo, COUNT(*)::int AS quantidade
       FROM stg_acidentes ${whereSql}
       GROUP BY 1
       ORDER BY 2 DESC`,
      ...params
    );

    const porUnidadeRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(NULLIF(TRIM(nmdepartamento),''),'Não informado') AS unidade, COUNT(*)::int AS quantidade
       FROM stg_acidentes ${whereSql}
       GROUP BY 1
       ORDER BY 2 DESC
       LIMIT 20`,
      ...params
    );

    const porMesRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT mes::int AS mes, COUNT(*)::int AS quantidade
       FROM stg_acidentes ${whereSql}
       GROUP BY mes
       ORDER BY mes`,
      ...params
    );
    const porMes: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) porMes[String(m).padStart(2, '0')] = 0;
    for (const r of porMesRows || []) {
      const m = Number(r.mes);
      if (m >= 1 && m <= 12) porMes[String(m).padStart(2, '0')] = Number(r.quantidade || 0);
    }

    // Não existe status na planilha → mantemos um único status "aberto"
    const porStatus = [{ status: 'aberto', quantidade: Number(totalAnoRow?.[0]?.total || 0) }];

    const comAfastamentoRow = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS total FROM stg_acidentes ${whereSql} AND (LOWER(COALESCE(houve_afastamento::text,'')) IN ('verdadeiro','true','1','sim','t','yes','y'))`,
      ...params
    );
    const semAfastamentoRow = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS total FROM stg_acidentes ${whereSql} AND NOT (LOWER(COALESCE(houve_afastamento::text,'')) IN ('verdadeiro','true','1','sim','t','yes','y'))`,
      ...params
    );

    return NextResponse.json({
      ok: true,
      totalAno: Number(totalAnoRow?.[0]?.total || 0),
      totalMes: Number(totalMesRow?.[0]?.total || 0),
      porRegional: (porRegionalRows || []).map((r) => ({ regional: r.regional, quantidade: r.quantidade })),
      porTipo: (porTipoRows || []).map((t) => ({ tipo: t.tipo, quantidade: t.quantidade })),
      porUnidade: (porUnidadeRows || []).map((u) => ({ unidade: u.unidade, quantidade: u.quantidade })),
      porMes,
      porStatus,
      comAfastamento: Number(comAfastamentoRow?.[0]?.total || 0),
      semAfastamento: Number(semAfastamentoRow?.[0]?.total || 0),
    });
  } catch (e: any) {
    console.error('[acidentes/stats] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
