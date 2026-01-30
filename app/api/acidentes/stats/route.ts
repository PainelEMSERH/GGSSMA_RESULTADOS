export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const anoParam = url.searchParams.get('ano');
    const semFiltroAno = anoParam == null || anoParam === '' || String(anoParam).toLowerCase() === 'todos';
    const filterByYear = !semFiltroAno;
    const ano = filterByYear ? anoParam : String(new Date().getFullYear());

    const dataParsedExpr = `(CASE
      WHEN TRIM(COALESCE(data_acidente,'')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (SUBSTRING(TRIM(data_acidente), 1, 10))::date
      WHEN TRIM(COALESCE(data_acidente,'')) ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}' THEN to_date(SUBSTRING(TRIM(data_acidente), 1, 10), 'DD/MM/YYYY')
      ELSE NULL END)`;
    const yearExpr = `EXTRACT(YEAR FROM ${dataParsedExpr})::int`;
    const monthExpr = `EXTRACT(MONTH FROM ${dataParsedExpr})::int`;

    const anoNum = parseInt(ano, 10);
    const params: any[] = [];
    let whereSql = 'WHERE 1=1';
    if (filterByYear) {
      params.push(anoNum);
      whereSql = `WHERE ( (ano IS NOT NULL AND ano::int = $1) OR ( (ano IS NULL OR ano::text = '') AND ${dataParsedExpr} IS NOT NULL AND ${yearExpr} = $1 ) )`;
      if (regional) {
        params.push(regional);
        whereSql += ` AND "Regional" ILIKE $2`;
      }
    } else {
      if (regional) {
        params.push(regional);
        whereSql += ` AND "Regional" ILIKE $1`;
      }
    }

    const mesAtual = new Date().getMonth() + 1;

    const totalAnoRow = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS total FROM stg_acidentes ${whereSql}`,
      ...params
    );
    const mesFilter = `( (mes IS NOT NULL AND mes::int = $${params.length + 1}) OR ( (mes IS NULL OR mes::text = '') AND ${dataParsedExpr} IS NOT NULL AND ${monthExpr} = $${params.length + 1} ) )`;
    const totalMesRow = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS total FROM stg_acidentes ${whereSql} AND ${mesFilter}`,
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

    const mesCol = `COALESCE(mes::int, ${monthExpr})::int`;
    const porMesRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT ${mesCol} AS mes, COUNT(*)::int AS quantidade
       FROM stg_acidentes ${whereSql}
       GROUP BY ${mesCol}
       ORDER BY 1`,
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

    let totalInvestigados = 0;
    let porRegionalInvestigados: Array<{ regional: string; quantidade: number }> = [];
    let porTipoInvestigados: Array<{ tipo: string; quantidade: number }> = [];
    try {
      totalInvestigados = await prisma.acidenteInvestigacao.count();
      const invPorReg = await prisma.acidenteInvestigacao.groupBy({
        by: ['regional'],
        _count: { id: true },
      });
      porRegionalInvestigados = invPorReg.map((r) => ({
        regional: r.regional && r.regional.trim() !== '' ? r.regional : 'Não informado',
        quantidade: r._count.id,
      })).sort((a, b) => b.quantidade - a.quantidade);
      const invPorTipo = await prisma.acidenteInvestigacao.groupBy({
        by: ['tipo'],
        _count: { id: true },
      });
      porTipoInvestigados = invPorTipo.map((t) => ({
        tipo: t.tipo && t.tipo.trim() !== '' ? t.tipo : 'outros',
        quantidade: t._count.id,
      })).sort((a, b) => b.quantidade - a.quantidade);
    } catch {
      // Tabela AcidenteInvestigacao pode não existir ou não ter colunas regional/tipo
    }

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
      totalInvestigados,
      porRegionalInvestigados,
      porTipoInvestigados,
    });
  } catch (e: any) {
    console.error('[acidentes/stats] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
