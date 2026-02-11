import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Meta vs Real CIPA: por mês, quantas atividades estavam previstas (data_fim_prevista)
 * e quantas foram concluídas (data_conclusao). Acumulado mês a mês.
 */
export async function GET(req: NextRequest) {
  try {
    const hasTable: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'cronograma_cipa'
      ) AS exists
    `);
    if (!hasTable?.[0]?.exists) {
      return NextResponse.json({
        ok: true,
        meta: {},
        realAcumulado: {},
        totalMeta: 0,
        totalReal: 0,
        ano: parseInt(new URL(req.url).searchParams.get('ano') || '2025', 10),
      });
    }

    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const ano = parseInt(url.searchParams.get('ano') || '2025', 10);

    const wh: string[] = [`ano_gestao = ${ano}`];
    if (regional) wh.push(`TRIM(regional) = '${String(regional).replace(/'/g, "''")}'`);
    const whereSql = `WHERE ${wh.join(' AND ')}`;

    // Total de atividades (meta = 12 por unidade)
    const totalMetaResult: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total FROM cronograma_cipa ${whereSql}
    `);
    const totalMeta = Number(totalMetaResult[0]?.total ?? 0);

    // Total concluídas (data_conclusao preenchida)
    const totalRealResult: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total FROM cronograma_cipa ${whereSql} AND data_conclusao IS NOT NULL
    `);
    const totalReal = Number(totalRealResult[0]?.total ?? 0);

    // Meta por mês: atividades cuja data_fim_prevista cai até o fim do mês (acumulado)
    const metaMeses: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      const mesStr = String(m).padStart(2, '0');
      const lastDay = new Date(ano, m, 0);
      const lastDayStr = `${ano}-${String(m).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      const r: any[] = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS total FROM cronograma_cipa
        ${whereSql}
        AND data_fim_prevista::date <= '${lastDayStr}'::date
      `);
      metaMeses[mesStr] = Number(r[0]?.total ?? 0);
    }

    // Real por mês: atividades com data_conclusao até o fim do mês (acumulado)
    const realMeses: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      const mesStr = String(m).padStart(2, '0');
      const lastDay = new Date(ano, m, 0);
      const lastDayStr = `${ano}-${String(m).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      const r: any[] = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS total FROM cronograma_cipa
        ${whereSql}
        AND data_conclusao IS NOT NULL AND data_conclusao::date <= '${lastDayStr}'::date
      `);
      realMeses[mesStr] = Number(r[0]?.total ?? 0);
    }

    const meses = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const meta: Record<string, number> = {};
    const realAcumulado: Record<string, number> = {};
    meses.forEach((mes) => {
      meta[mes] = metaMeses[mes] ?? 0;
      realAcumulado[mes] = realMeses[mes] ?? 0;
    });

    return NextResponse.json({
      ok: true,
      meta,
      realAcumulado,
      totalMeta,
      totalReal,
      ano,
    });
  } catch (e: any) {
    console.error('[cipa/meta-real] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
