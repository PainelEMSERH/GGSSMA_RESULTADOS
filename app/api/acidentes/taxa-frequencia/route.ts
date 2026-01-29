export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

/** HHT = colaboradores ativos × 150 (por mês). */
const HHT_POR_ATIVO = 150;

/** Calcula colaboradores ativos por mês a partir do Alterdata: admitidos até o fim do mês e (demissão vazia ou demissão após o fim do mês). */
async function ativosPorMesAlterdata(ano: number): Promise<Record<number, number> | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      WITH ultimo_dia AS (
        SELECT m AS mes, (make_date($1::int, m, 1) + interval '1 month' - interval '1 day')::date AS fim
        FROM generate_series(1, 12) AS m
      ),
      base AS (
        SELECT
          COALESCE(a.cpf, '') AS cpf,
          CASE
            WHEN TRIM(COALESCE(a.admissao,'')) ~ '^\\d+$' THEN (DATE '1899-12-30' + TRIM(a.admissao)::int)::date
            WHEN TRIM(COALESCE(a.admissao,'')) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.admissao), 1, 10)::date
            WHEN TRIM(COALESCE(a.admissao,'')) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.admissao), 1, 10), 'DD/MM/YYYY')
            ELSE NULL
          END AS admissao_d,
          CASE
            WHEN a.demissao IS NULL OR TRIM(COALESCE(a.demissao,'')) = '' THEN NULL
            WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + TRIM(a.demissao)::int)::date
            WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
            WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
            ELSE NULL
          END AS demissao_d
        FROM stg_alterdata_v2 a
        WHERE COALESCE(a.cpf, '') != ''
      )
      SELECT ud.mes::int AS mes, COUNT(DISTINCT b.cpf)::int AS ativos
      FROM ultimo_dia ud
      CROSS JOIN base b
      WHERE b.admissao_d IS NOT NULL
        AND b.admissao_d <= ud.fim
        AND (b.demissao_d IS NULL OR b.demissao_d > ud.fim)
      GROUP BY ud.mes
      ORDER BY ud.mes
      `,
      ano
    );
    const out: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) out[m] = 0;
    for (const r of rows || []) {
      const mes = Number(r.mes);
      if (mes >= 1 && mes <= 12) out[mes] = Number(r.ativos ?? 0);
    }
    return out;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const ano = parseInt(url.searchParams.get('ano') || String(new Date().getFullYear()), 10);

    const params: any[] = [ano];
    let whereStg = `WHERE ano = $1`;
    if (regional) {
      params.push(regional);
      whereStg += ` AND "Regional" ILIKE $2`;
    }

    const [ativosAlterdata, ativosRows, acidentesPorMesRows] = await Promise.all([
      ativosPorMesAlterdata(ano),
      prisma.ativosMensal.findMany({
        where: { ano },
        orderBy: { mes: 'asc' },
      }),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT mes::int AS mes, COUNT(*)::int AS quantidade
         FROM stg_acidentes ${whereStg}
         GROUP BY mes ORDER BY mes`,
        ...params
      ),
    ]);

    const ativosPorMes: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) ativosPorMes[m] = 0;
    if (ativosAlterdata) {
      for (let m = 1; m <= 12; m++) ativosPorMes[m] = ativosAlterdata[m] ?? 0;
    } else {
      for (const r of ativosRows) {
        if (r.mes >= 1 && r.mes <= 12) ativosPorMes[r.mes] = r.ativos;
      }
    }
    const acidentesPorMes: Record<number, number> = {};
    for (const r of acidentesPorMesRows || []) {
      const m = Number(r.mes);
      if (m >= 1 && m <= 12) acidentesPorMes[m] = Number(r.quantidade || 0);
    }

    const registros: Array<{
      mes: number;
      ativos: number;
      horasHomemTrabalhadas: number;
      numeroAcidentes: number;
      taxaFrequencia: number | null;
    }> = [];
    for (let mes = 1; mes <= 12; mes++) {
      const ativos = ativosPorMes[mes] ?? 0;
      const horasHomemTrabalhadas = ativos * HHT_POR_ATIVO;
      const numeroAcidentes = acidentesPorMes[mes] ?? 0;
      const taxaFrequencia =
        horasHomemTrabalhadas > 0
          ? (numeroAcidentes * 1_000_000) / horasHomemTrabalhadas
          : null;
      registros.push({
        mes,
        ativos,
        horasHomemTrabalhadas,
        numeroAcidentes,
        taxaFrequencia: taxaFrequencia != null ? Math.round(taxaFrequencia * 100) / 100 : null,
      });
    }

    return NextResponse.json({
      ok: true,
      registros,
      fonteAtivos: ativosAlterdata ? 'alterdata' : 'manual',
    });
  } catch (e: any) {
    console.error('[acidentes/taxa-frequencia][GET] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      ano,
      mes,
      numeroAcidentes,
      horasHomemTrabalhadas,
    }: {
      ano: number;
      mes: number;
      numeroAcidentes: number;
      horasHomemTrabalhadas: number;
    } = body;

    if (!ano || !mes) {
      return NextResponse.json(
        { ok: false, error: 'Ano e mês são obrigatórios' },
        { status: 400 },
      );
    }
    if (numeroAcidentes == null || numeroAcidentes < 0) {
      return NextResponse.json(
        { ok: false, error: 'Número de acidentes inválido' },
        { status: 400 },
      );
    }
    if (!horasHomemTrabalhadas || horasHomemTrabalhadas <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Total de horas-homem trabalhadas deve ser maior que zero' },
        { status: 400 },
      );
    }

    const tf = (numeroAcidentes * 1_000_000) / horasHomemTrabalhadas;

    const registro = await prisma.taxaFrequenciaAcidente.upsert({
      where: {
        ano_mes: {
          ano,
          mes,
        },
      },
      update: {
        numeroAcidentes,
        horasHomemTrabalhadas,
        taxaFrequencia: tf,
      },
      create: {
        ano,
        mes,
        numeroAcidentes,
        horasHomemTrabalhadas,
        taxaFrequencia: tf,
      },
    });

    return NextResponse.json({ ok: true, registro });
  } catch (e: any) {
    console.error('[acidentes/taxa-frequencia][POST] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}

