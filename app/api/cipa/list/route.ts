import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Lista cronograma CIPA com filtros. Para ano 2026, se não houver dados no banco,
 * retorna dados calculados a partir da data de posse 2025 (sem persistir).
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
      return NextResponse.json({ ok: true, rows: [], total: 0 });
    }

    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const unidade = (url.searchParams.get('unidade') || '').trim();
    const ano = url.searchParams.get('ano') || '2025';
    const anoNum = parseInt(ano, 10);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '50', 10)));
    const offset = (page - 1) * pageSize;

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

    // Se ano 2026 e não tem nenhum registro, retorna dados calculados a partir de 2025
    if (anoNum === 2026 && total === 0 && !regional && !unidade) {
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
    if (anoNum === 2026 && total === 0) {
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

/** Ajusta data para dia útil: sábado -> sexta, domingo -> segunda */
function toWeekday(d: Date): Date {
  const day = d.getDay();
  if (day === 6) {
    d.setDate(d.getDate() - 1);
  } else if (day === 0) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const NOMES_ATIVIDADES: Record<number, string> = {
  1: 'Ofício Comunicação à Unidade e Sindicato',
  2: 'Constituição da Comissão Eleitoral',
  3: 'Convocação para as Inscrições',
  4: 'Período de Inscrição',
  5: 'Edital de Divulgação de Candidatos Inscritos',
  6: 'Período de Campanha Eleitoral',
  7: 'Período da Eleição',
  8: 'Ata de Eleição e Apuração de Votos',
  9: 'Solicitar Indicados',
  10: 'Treinamento CIPA',
  11: 'Emissão Certificado',
  12: 'Reunião de Posse',
};

/**
 * Calcula datas 2026 a partir da data de posse 2025 (atividade 12) por unidade.
 * Regras:
 * - Posse 2026 = posse 2025 + 364
 * - Ofício = posse anterior + 365 - 60 = posse_2025 + 305
 * - Constituição = posse_2026 + 5 (ajuste sábado/domingo)
 * - Convocação = Constituição + 20
 * - Período Inscrição = Convocação (início); fim = Convocação + 14
 * - Edital = fim período inscrição + 1 = Convocação + 15
 * - Campanha = Edital + 1
 * - Eleição = Campanha
 * - Ata = posse_2026 - 30
 * - Solicitar Indicados = Ata
 * - Treinamento = Ata + 2
 * - Emissão = Treinamento + 7
 * - Reunião Posse = posse_2026
 */
async function compute2026From2025(
  p: { $queryRawUnsafe: (sql: string, ...args: any[]) => Promise<any[]> },
  filterRegional: string,
  filterUnidade: string
): Promise<any[]> {
  const wh: string[] = ['ano_gestao = 2025', 'atividade_codigo = 12'];
  if (filterRegional) wh.push(`TRIM(regional) = '${String(filterRegional).replace(/'/g, "''")}'`);
  if (filterUnidade) wh.push(`TRIM(unidade) = '${String(filterUnidade).replace(/'/g, "''")}'`);
  const whereSql = `WHERE ${wh.join(' AND ')}`;

  const posseRows: any[] = await p.$queryRawUnsafe(`
    SELECT DISTINCT TRIM(regional) AS regional, TRIM(unidade) AS unidade,
           data_posse_gestao::text AS data_posse_gestao
    FROM cronograma_cipa
    ${whereSql}
    AND data_posse_gestao IS NOT NULL
    ORDER BY regional, unidade
  `);

  const out: any[] = [];
  for (const row of posseRows) {
    const reg = String(row.regional ?? '').trim();
    const uni = String(row.unidade ?? '').trim();
    const posse2025Str = String(row.data_posse_gestao ?? '').slice(0, 10);
    if (!posse2025Str || !/^\d{4}-\d{2}-\d{2}$/.test(posse2025Str)) continue;
    const [y, m, d] = posse2025Str.split('-').map(Number);
    const posse2025 = new Date(y, m - 1, d);
    const posse2026 = addDays(posse2025, 364);

    const constituicao = toWeekday(addDays(posse2026, 5));
    const convocacao = addDays(constituicao, 20);
    const edital = addDays(convocacao, 15);
    const campanha = addDays(edital, 1);
    const ata = addDays(posse2026, -30);
    const treinamento = addDays(ata, 2);
    const emissao = addDays(treinamento, 7);
    const oficio = addDays(posse2025, 305);
    const periodoInicio = convocacao;
    const periodoFim = addDays(convocacao, 14);

    const activities: { cod: number; nome: string; inicio: Date; fim: Date; conclusao: null; posse: Date }[] = [
      { cod: 1, nome: NOMES_ATIVIDADES[1], inicio: oficio, fim: addDays(oficio, 2), conclusao: null, posse: posse2026 },
      { cod: 2, nome: NOMES_ATIVIDADES[2], inicio: constituicao, fim: addDays(constituicao, 2), conclusao: null, posse: posse2026 },
      { cod: 3, nome: NOMES_ATIVIDADES[3], inicio: convocacao, fim: addDays(convocacao, 1), conclusao: null, posse: posse2026 },
      { cod: 4, nome: NOMES_ATIVIDADES[4], inicio: periodoInicio, fim: periodoFim, conclusao: null, posse: posse2026 },
      { cod: 5, nome: NOMES_ATIVIDADES[5], inicio: addDays(periodoFim, 1), fim: addDays(periodoFim, 2), conclusao: null, posse: posse2026 },
      { cod: 6, nome: NOMES_ATIVIDADES[6], inicio: campanha, fim: addDays(campanha, 3), conclusao: null, posse: posse2026 },
      { cod: 7, nome: NOMES_ATIVIDADES[7], inicio: campanha, fim: addDays(campanha, 3), conclusao: null, posse: posse2026 },
      { cod: 8, nome: NOMES_ATIVIDADES[8], inicio: ata, fim: addDays(ata, 1), conclusao: null, posse: posse2026 },
      { cod: 9, nome: NOMES_ATIVIDADES[9], inicio: ata, fim: addDays(ata, 1), conclusao: null, posse: posse2026 },
      { cod: 10, nome: NOMES_ATIVIDADES[10], inicio: treinamento, fim: addDays(treinamento, 26), conclusao: null, posse: posse2026 },
      { cod: 11, nome: NOMES_ATIVIDADES[11], inicio: emissao, fim: addDays(emissao, 26), conclusao: null, posse: posse2026 },
      { cod: 12, nome: NOMES_ATIVIDADES[12], inicio: addDays(posse2026, -1), fim: posse2026, conclusao: null, posse: posse2026 },
    ];

    for (const a of activities) {
      out.push({
        id: `2026-${reg}-${uni}-${a.cod}`,
        regional: reg,
        unidade: uni,
        ano_gestao: 2026,
        atividade_codigo: a.cod,
        atividade_nome: a.nome,
        data_inicio_prevista: dateToYMD(a.inicio),
        data_fim_prevista: dateToYMD(a.fim),
        data_conclusao: null,
        data_posse_gestao: dateToYMD(a.posse),
      });
    }
  }
  return out.sort((a, b) => {
    if (a.regional !== b.regional) return a.regional.localeCompare(b.regional);
    if (a.unidade !== b.unidade) return a.unidade.localeCompare(b.unidade);
    return a.atividade_codigo - b.atividade_codigo;
  });
}
