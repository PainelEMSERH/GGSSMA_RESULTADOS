import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Garante que a tabela ordem_servico existe
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ordem_servico (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        colaborador_cpf TEXT NOT NULL,
        entregue BOOLEAN NOT NULL DEFAULT false,
        data_entrega DATE,
        responsavel TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(colaborador_cpf)
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_colaborador_cpf ON ordem_servico(colaborador_cpf);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_data_entrega ON ordem_servico(data_entrega);
    `);

    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const unidade = (url.searchParams.get('unidade') || '').trim();
    const entregue = url.searchParams.get('entregue') || '';
    const search = (url.searchParams.get('search') || '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '25', 10)));
    const sortBy = url.searchParams.get('sortBy') || 'nome';
    const sortDir = url.searchParams.get('sortDir') || 'asc';

    const offset = (page - 1) * pageSize;
    const DEMISSAO_LIMITE = '2026-01-01';

    // Verifica se stg_alterdata_v2 existe
    const hasTable: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_alterdata_v2'
      ) AS exists
    `);
    
    if (!hasTable?.[0]?.exists) {
      return NextResponse.json({ ok: true, rows: [], total: 0 });
    }

    // Verifica se stg_unid_reg existe
    const hasUnidReg: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `);
    const useJoin = hasUnidReg?.[0]?.exists;

    // Monta condições WHERE - EXATAMENTE como entregas
    const wh: string[] = [];

    // Filtro de demissão: Remove apenas demitidos antes de 2026-01-01
    // Converte data corretamente antes de comparar (suporta YYYY-MM-DD e DD/MM/YYYY)
    wh.push(`(
      a.demissao IS NULL 
      OR a.demissao = '' 
      OR TRIM(a.demissao) = ''
      OR (
        CASE 
          WHEN a.demissao ~ '^\\d{4}-\\d{2}-\\d{2}' THEN a.demissao::date
          WHEN a.demissao ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(a.demissao, 'DD/MM/YYYY')
          ELSE NULL
        END IS NULL
        OR CASE 
          WHEN a.demissao ~ '^\\d{4}-\\d{2}-\\d{2}' THEN a.demissao::date
          WHEN a.demissao ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(a.demissao, 'DD/MM/YYYY')
          ELSE NULL
        END >= '${DEMISSAO_LIMITE}'::date
      )
    )`);

    // Filtro de regional
    if (regional && useJoin) {
      const escReg = regional.replace(/'/g, "''");
      wh.push(`(UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${escReg}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
        SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${escReg}'))
      ))`);
    }

    // Filtro de unidade
    if (unidade) {
      const escUni = unidade.replace(/'/g, "''");
      if (useJoin) {
        wh.push(`(UPPER(TRIM(COALESCE(u.nmdepartamento, ''))) = UPPER(TRIM('${escUni}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${escUni}')) OR UPPER(TRIM(COALESCE(u.nmdepartamento, ''))) LIKE UPPER(TRIM('%${escUni}%')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER(TRIM('%${escUni}%')))`);
      } else {
        wh.push(`(UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${escUni}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER(TRIM('%${escUni}%')))`);
      }
    }

    // Filtro de busca
    if (search) {
      const escSearch = search.replace(/'/g, "''");
      wh.push(`(
        a.colaborador ILIKE '%${escSearch}%' OR
        a.cpf ILIKE '%${escSearch}%' OR
        a.matricula ILIKE '%${escSearch}%'
      )`);
    }

    const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';

    // Query EXATAMENTE como entregas - linhas 339-368
    const rowsSql = useJoin ? `
      SELECT
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.colaborador, '') AS nome,
        COALESCE(a.matricula, '') AS matricula,
        COALESCE(NULLIF(TRIM(u.nmdepartamento), ''), NULLIF(TRIM(a.unidade_hospitalar), ''), '') AS unidade,
        COALESCE(NULLIF(TRIM(u.regional_responsavel), ''), '') AS regional,
        COALESCE(a.funcao, '') AS funcao,
        CASE 
          WHEN a.admissao IS NULL OR a.admissao = '' OR TRIM(a.admissao) = '' THEN NULL
          WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(a.admissao, 1, 10)
          WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(a.admissao, 1, 10), 'DD/MM/YYYY')::text
          WHEN a.admissao ~ '^\\d{1,2}/\\d{1,2}/\\d{4}' THEN to_date(a.admissao, 'DD/MM/YYYY')::text
          WHEN a.admissao ~ '^\\d{8}' THEN to_date(a.admissao, 'DDMMYYYY')::text
          ELSE NULL
        END AS "dataAdmissao",
        COALESCE(os.entregue, false) AS "osEntregue",
        os.data_entrega::text AS "dataEntregaOS",
        os.responsavel AS "responsavelEntrega"
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      LEFT JOIN ordem_servico os ON os.colaborador_cpf = a.cpf
      ${whereSql}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
      ORDER BY 
        ${sortBy === 'nome' ? 'a.colaborador' : 
          sortBy === 'unidade' ? 'unidade' : 
          sortBy === 'regional' ? 'regional' :
          sortBy === 'dataAdmissao' ? '"dataAdmissao"' :
          'a.colaborador'} ${sortDir.toUpperCase()}
      LIMIT ${pageSize} OFFSET ${offset}
    ` : `
      SELECT
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.colaborador, '') AS nome,
        COALESCE(a.matricula, '') AS matricula,
        COALESCE(a.unidade_hospitalar, '') AS unidade,
        '' AS regional,
        COALESCE(a.funcao, '') AS funcao,
        CASE 
          WHEN a.admissao IS NULL OR a.admissao = '' OR TRIM(a.admissao) = '' THEN NULL
          WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(a.admissao, 1, 10)
          WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(a.admissao, 1, 10), 'DD/MM/YYYY')::text
          WHEN a.admissao ~ '^\\d{1,2}/\\d{1,2}/\\d{4}' THEN to_date(a.admissao, 'DD/MM/YYYY')::text
          WHEN a.admissao ~ '^\\d{8}' THEN to_date(a.admissao, 'DDMMYYYY')::text
          ELSE NULL
        END AS "dataAdmissao",
        COALESCE(os.entregue, false) AS "osEntregue",
        os.data_entrega::text AS "dataEntregaOS",
        os.responsavel AS "responsavelEntrega"
      FROM stg_alterdata_v2 a
      LEFT JOIN ordem_servico os ON os.colaborador_cpf = a.cpf
      ${whereSql}
      ORDER BY 
        ${sortBy === 'nome' ? 'a.colaborador' : 
          sortBy === 'unidade' ? 'unidade' : 
          sortBy === 'regional' ? 'regional' :
          sortBy === 'dataAdmissao' ? '"dataAdmissao"' :
          'a.colaborador'} ${sortDir.toUpperCase()}
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countSql = useJoin ? `
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      ${whereSql}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    ` : `
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2 a
      ${whereSql}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    `;

    const [rowsResult, totalResult] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(rowsSql),
      prisma.$queryRawUnsafe<any[]>(countSql),
    ]);

    const rowsRaw = Array.isArray(rowsResult) ? rowsResult : [];
    const total = Number((totalResult as any)?.[0]?.total ?? 0);

    // Filtra por status de entrega se necessário
    let filteredRows = rowsRaw;
    if (entregue === 'sim') {
      filteredRows = rowsRaw.filter((r: any) => r.osEntregue === true);
    } else if (entregue === 'nao') {
      filteredRows = rowsRaw.filter((r: any) => !r.osEntregue);
    }

    // Retorna exatamente como a query retorna - sem transformações complexas
    const rowsFinal = filteredRows.map((r: any) => ({
      id: String(r.cpf || ''),
      nome: String(r.nome || ''),
      cpf: String(r.cpf || ''),
      matricula: String(r.matricula || ''),
      unidade: String(r.unidade || ''),
      regional: String(r.regional || ''),
      funcao: String(r.funcao || ''),
      dataAdmissao: r.dataAdmissao ? String(r.dataAdmissao) : null,
      osEntregue: Boolean(r.osEntregue),
      dataEntregaOS: r.dataEntregaOS ? String(r.dataEntregaOS) : null,
      responsavelEntrega: r.responsavelEntrega ? String(r.responsavelEntrega) : null,
    }));

    return NextResponse.json({
      ok: true,
      rows: rowsFinal,
      total: entregue ? filteredRows.length : total,
    });
  } catch (e: any) {
    console.error('[ordem-servico/list] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
