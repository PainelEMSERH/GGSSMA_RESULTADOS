export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const unidade = url.searchParams.get('unidade') || '';
    const tipo = url.searchParams.get('tipo') || '';
    const status = url.searchParams.get('status') || '';
    const empresa = url.searchParams.get('empresa') || '';
    const ano = url.searchParams.get('ano') || String(new Date().getFullYear());
    const mes = url.searchParams.get('mes') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '25', 10);
    const q = url.searchParams.get('q') || '';

    // Fonte agora é a tabela stg_acidentes (CSV do Alterdata/planilha) no Neon.
    // IMPORTANTe: essa rota é somente leitura.
    const params: any[] = [];
    let p = 1;
    const where: string[] = [];

    // ano obrigatório (coluna gerada)
    params.push(parseInt(ano, 10));
    where.push(`ano = $${p++}`);

    if (regional) {
      params.push(regional);
      where.push(`("Regional" ILIKE $${p++})`);
    }
    if (unidade) {
      params.push(`%${unidade}%`);
      where.push(`(nmdepartamento ILIKE $${p++})`);
    }
    if (tipo) {
      // Na planilha o campo é "Tipo_Acidente"
      params.push(tipo);
      where.push(`("Tipo_Acidente" ILIKE $${p++})`);
    }
    if (status) {
      // Não existe status na planilha; ignora (mantém compatibilidade do filtro)
    }
    if (empresa) {
      // Não existe empresa na planilha; ignora (mantém compatibilidade do filtro)
    }
    if (mes) {
      params.push(parseInt(mes, 10));
      where.push(`mes = $${p++}`);
    }
    if (q) {
      params.push(`%${q}%`);
      const qParam = `$${p++}`;
      where.push(`(
        "NmFuncionario" ILIKE ${qParam}
        OR nmdepartamento ILIKE ${qParam}
        OR COALESCE(numero_cat,'') ILIKE ${qParam}
        OR COALESCE(codigo_cid,'') ILIKE ${qParam}
        OR COALESCE(observacoes_cat,'') ILIKE ${qParam}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const offset = (page - 1) * pageSize;
    params.push(pageSize, offset);
    const limitParam = `$${p++}`;
    const offsetParam = `$${p++}`;

    const rowsSql = `
      SELECT
        COALESCE(numero_cat, '') AS "numeroCAT",
        COALESCE("NmFuncionario",'') AS "nome",
        COALESCE(nmdepartamento,'') AS "unidadeHospitalar",
        NULLIF(TRIM(COALESCE("Regional",'')),'') AS "regional",
        COALESCE("Tipo_Acidente",'outros') AS "tipo",
        (LOWER(COALESCE(houve_afastamento::text,'')) IN ('verdadeiro','true','1','sim','t','yes','y')) AS "comAfastamento",
        (CASE WHEN data_acidente IS NOT NULL AND TRIM(data_acidente) <> '' THEN to_date(data_acidente, 'DD/MM/YYYY')::timestamptz ELSE NULL END) AS "data",
        NULLIF(TRIM(COALESCE(hora_formatada, '')), '') AS "hora",
        mes::int AS "mes",
        ano::int AS "ano",
        NULL::text AS "riat",
        NULL::text AS "sinan",
        'aberto'::text AS "status",
        NULLIF(TRIM(COALESCE(descricao_complementar_lesao,'')),'') AS "descricao",
        NULLIF(TRIM(COALESCE(nmfuncao,'')),'') AS "funcaoTrabalhador",
        NULL::text AS "tipoVinculo",
        NULLIF(TRIM(COALESCE(descricao_situacao_geradora,'')),'') AS "causaImediata",
        NULLIF(TRIM(COALESCE(descricao_natureza_lesao,'')),'') AS "causaRaiz",
        NULLIF(TRIM(COALESCE(observacoes_cat,'')),'') AS "fatoresContrib",
        COALESCE(NrCPF,'') AS "cpf"
      FROM stg_acidentes
      ${whereSql}
      ORDER BY (CASE WHEN data_acidente IS NOT NULL AND TRIM(data_acidente) <> '' THEN to_date(data_acidente, 'DD/MM/YYYY') END) DESC NULLS LAST
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `;

    const totalSql = `
      SELECT COUNT(*)::int AS total
      FROM stg_acidentes
      ${whereSql}
    `;

    const [rows, tot] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(rowsSql, ...params),
      prisma.$queryRawUnsafe<any[]>(totalSql, ...params.slice(0, params.length - 2)),
    ]);

    const total = tot?.[0]?.total ?? 0;

    // Chave estável (igual ao frontend): numeroCAT|dataISO|nome
    const toRef = (r: any) => {
      const cat = (r?.numeroCAT ?? '').toString().trim();
      const data = (r?.data ?? '').toString().replace(/T.*$/, '').trim();
      const nome = (r?.nome ?? '').toString().trim();
      return `${cat}|${data}|${nome}`;
    };
    const refs = rows.map(toRef).filter(Boolean);
    const investigados = refs.length
      ? await prisma.acidenteInvestigacao.findMany({
          where: { acidenteRef: { in: refs } },
          select: { acidenteRef: true },
        })
      : [];
    const setRef = new Set(investigados.map((i) => i.acidenteRef));

    const rowsWithFlag = rows.map((r: any) => ({
      ...r,
      id: toRef(r),
      hasInvestigacao: setRef.has(toRef(r)),
    }));

    return NextResponse.json({
      ok: true,
      rows: rowsWithFlag,
      total,
      page,
      pageSize,
    });
  } catch (e: any) {
    console.error('[acidentes/list] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
