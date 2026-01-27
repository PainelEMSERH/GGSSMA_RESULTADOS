import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type OrdemServicoRow = {
  id: string; // CPF
  nome: string;
  cpf: string;
  matricula: string;
  unidade: string;
  regional: string;
  funcao: string;
  dataAdmissao: string | null;
  osEntregue: boolean;
  dataEntregaOS: string | null;
  responsavelEntrega: string | null;
};

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
    const regional = url.searchParams.get('regional') || '';
    const unidade = url.searchParams.get('unidade') || '';
    const entregue = url.searchParams.get('entregue') || '';
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '25', 10);
    const sortBy = url.searchParams.get('sortBy') || 'nome';
    const sortDir = url.searchParams.get('sortDir') || 'asc';

    const offset = (page - 1) * pageSize;

    // Filtro: colaboradores ativos em 2026
    // - Admitidos em qualquer data (não importa o ano)
    // - NÃO demitidos antes de 2026-01-01
    // - Se foi demitido em 2026 ou depois, ainda conta (estava ativo no início de 2026)
    const DEMISSAO_LIMITE = '2026-01-01';
    let whereConditions: string[] = [];
    
    // Filtro de demissão: remove apenas os demitidos ANTES de 2026-01-01
    whereConditions.push(`(a.demissao IS NULL OR a.demissao = '' OR TRIM(a.demissao) = '' OR 
      CASE 
        WHEN a.demissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.demissao::date
        WHEN a.demissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.demissao, 'DD/MM/YYYY')
        ELSE NULL
      END >= '${DEMISSAO_LIMITE}'::date)`);

    // Verifica se stg_unid_reg existe
    const hasUnidRegCheck: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `);
    const useJoin = hasUnidRegCheck?.[0]?.exists;

    if (regional && useJoin) {
      whereConditions.push(`(UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${regional.replace(/'/g, "''")}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
        SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${regional.replace(/'/g, "''")}'))
      ))`);
    }

    if (unidade) {
      if (useJoin) {
        whereConditions.push(`(UPPER(TRIM(COALESCE(u.nmdepartamento, ''))) = UPPER(TRIM('${unidade.replace(/'/g, "''")}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${unidade.replace(/'/g, "''")}')) OR UPPER(TRIM(COALESCE(u.nmdepartamento, ''))) LIKE UPPER(TRIM('%${unidade.replace(/'/g, "''")}%')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER(TRIM('%${unidade.replace(/'/g, "''")}%')))`);
      } else {
        whereConditions.push(`(UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${unidade.replace(/'/g, "''")}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER(TRIM('%${unidade.replace(/'/g, "''")}%')))`);
      }
    }

    if (search) {
      const searchEscaped = search.replace(/'/g, "''");
      whereConditions.push(`(
        a.colaborador ILIKE '%${searchEscaped}%' OR
        a.cpf ILIKE '%${searchEscaped}%' OR
        a.matricula ILIKE '%${searchEscaped}%'
      )`);
    }

    const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Usa exatamente o mesmo padrão da página de entregas
    const query = useJoin ? `
      SELECT
        COALESCE(a.cpf, '') AS id,
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.colaborador, '') AS nome,
        COALESCE(a.matricula, '') AS matricula,
        COALESCE(NULLIF(TRIM(u.nmdepartamento), ''), NULLIF(TRIM(a.unidade_hospitalar), ''), '') AS unidade,
        COALESCE(NULLIF(TRIM(u.regional_responsavel), ''), '') AS regional,
        COALESCE(a.funcao, '') AS funcao,
        CASE 
          WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::text
          WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')::text
          ELSE NULL
        END AS "dataAdmissao",
        COALESCE(os.entregue, false) AS "osEntregue",
        os.data_entrega::text AS "dataEntregaOS",
        os.responsavel AS "responsavelEntrega"
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      LEFT JOIN ordem_servico os ON os.colaborador_cpf = a.cpf
      ${whereSql}
      ORDER BY 
        ${sortBy === 'nome' ? 'a.colaborador' : 
          sortBy === 'unidade' ? 'unidade' : 
          sortBy === 'regional' ? 'regional' :
          sortBy === 'dataAdmissao' ? '"dataAdmissao"' :
          'a.colaborador'} ${sortDir.toUpperCase()}
      LIMIT ${pageSize} OFFSET ${offset}
    ` : `
      SELECT
        COALESCE(a.cpf, '') AS id,
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.colaborador, '') AS nome,
        COALESCE(a.matricula, '') AS matricula,
        COALESCE(a.unidade_hospitalar, '') AS unidade,
        '' AS regional,
        COALESCE(a.funcao, '') AS funcao,
        CASE 
          WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::text
          WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')::text
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

    const countQuery = useJoin ? `
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      ${whereSql}
    ` : `
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2 a
      ${whereSql}
    `;

    // Executa queries
    console.log('[ordem-servico/list] Query:', query);
    console.log('[ordem-servico/list] Count query:', countQuery);
    
    const rows: any[] = await prisma.$queryRawUnsafe(query);
    const countResult: any[] = await prisma.$queryRawUnsafe(countQuery);
    const total = parseInt(countResult[0]?.total || '0', 10);
    
    console.log('[ordem-servico/list] Total encontrado:', total);
    console.log('[ordem-servico/list] Rows retornados:', rows.length);

    // Filtra por status de entrega se necessário
    let filteredRows = rows;
    if (entregue === 'sim') {
      filteredRows = rows.filter((r) => r.osEntregue === true);
    } else if (entregue === 'nao') {
      filteredRows = rows.filter((r) => !r.osEntregue);
    }

    return NextResponse.json({
      ok: true,
      rows: filteredRows.map((r) => ({
        id: String(r.id || ''),
        nome: String(r.nome || ''),
        cpf: String(r.cpf || ''),
        matricula: String(r.matricula || ''),
        unidade: String(r.unidade || ''),
        regional: String(r.regional || ''),
        funcao: String(r.funcao || ''),
        dataAdmissao: r.dataAdmissao ? String(r.dataAdmissao) : null,
        osEntregue: r.osEntregue || false,
        dataEntregaOS: r.dataEntregaOS ? String(r.dataEntregaOS) : null,
        responsavelEntrega: r.responsavelEntrega ? String(r.responsavelEntrega) : null,
      })),
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
