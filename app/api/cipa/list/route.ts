import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { compute2026From2025 } from '@/lib/cipa/compute-2026';

/**
 * Lista cronograma CIPA com filtros.
 * 2025 = lê do banco (Neon tem os dados de 2025).
 * 2026 = SEMPRE calculado pelas regras de data (posse por unidade), nunca do banco.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const unidade = (url.searchParams.get('unidade') || '').trim();
    const ano = url.searchParams.get('ano') || '2025';
    const anoNum = parseInt(ano, 10);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '50', 10)));
    const offset = (page - 1) * pageSize;

    // 2026: sempre datas calculadas pelas regras (posse do ano anterior por unidade)
    if (anoNum === 2026) {
      const hasTable: any[] = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT 1 FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'cronograma_cipa'
        ) AS exists
      `);
      if (!hasTable?.[0]?.exists) {
        return NextResponse.json({ ok: true, rows: [], total: 0, computed: true });
      }
      const rows2026 = await compute2026From2025(prisma, regional, unidade);
      const total2026 = rows2026.length;
      const paged = rows2026.slice(offset, offset + pageSize);
      return NextResponse.json({
        ok: true,
        rows: paged,
        total: total2026,
        computed: true,
      });
    }

    const hasTable: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'cronograma_cipa'
      ) AS exists
    `);
    if (!hasTable?.[0]?.exists) {
      return NextResponse.json({ ok: true, rows: [], total: 0 });
    }

    const wh: string[] = [`ano_gestao = ${anoNum}`];
    if (regional) wh.push(`TRIM(regional) = '${String(regional).replace(/'/g, "''")}'`);
    if (unidade) wh.push(`TRIM(unidade) = '${String(unidade).replace(/'/g, "''")}'`);
    const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';

    const rowsSql = `
      SELECT id, regional, unidade, ano_gestao, atividade_codigo, atividade_nome,
             data_inicio_prevista::text AS data_inicio_prevista,
             data_fim_prevista::text AS data_fim_prevista,
             data_conclusao::text AS data_conclusao,
             data_posse_gestao::text AS data_posse_gestao
      FROM cronograma_cipa
      ${whereSql}
      ORDER BY regional, unidade, atividade_codigo
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM cronograma_cipa ${whereSql}`;

    const [rowsResult, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(rowsSql),
      prisma.$queryRawUnsafe<any[]>(countSql),
    ]);
    const rows = Array.isArray(rowsResult) ? rowsResult : [];
    const total = Number((countResult as any)?.[0]?.total ?? 0);

    const normalized = rows.map((r: any) => {
      const anoGestao = Number(r.ano_gestao) || 0;
      return {
        id: r.id,
        regional: String(r.regional ?? ''),
        unidade: String(r.unidade ?? ''),
        ano_gestao: anoGestao,
        atividade_codigo: Number(r.atividade_codigo) || 0,
        atividade_nome: String(r.atividade_nome ?? ''),
        data_inicio_prevista: r.data_inicio_prevista ? String(r.data_inicio_prevista).slice(0, 10) : null,
        data_fim_prevista: r.data_fim_prevista ? String(r.data_fim_prevista).slice(0, 10) : null,
        // 2026 sempre deve ter conclusão em branco para preenchimento
        data_conclusao: anoGestao === 2026 ? null : (r.data_conclusao ? String(r.data_conclusao).slice(0, 10) : null),
        data_posse_gestao: r.data_posse_gestao ? String(r.data_posse_gestao).slice(0, 10) : null,
      };
    });

    return NextResponse.json({ ok: true, rows: normalized, total });
  } catch (e: any) {
    console.error('[cipa/list] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
