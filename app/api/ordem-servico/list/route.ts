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

    // Data de início: 01/01/2026
    const dataInicio = '2026-01-01';

    // Monta query para buscar colaboradores que iniciaram em 01/01/2026
    // Usa a mesma lógica da página de entregas - parse da data como TEXT
    // Aceita tanto '2026-01-01' quanto '01/01/2026'
    let whereConditions: string[] = [];
    whereConditions.push(`(
      CASE 
        WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::date
        WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')
        ELSE NULL
      END
    ) = '${dataInicio}'::date`);
    
    // Filtro de demissão: apenas demitidos antes de 2026-01-01 são removidos
    const DEMISSAO_LIMITE = '2026-01-01';
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
      whereConditions.push(`(UPPER(TRIM(COALESCE(ur.regional_responsavel, ''))) = UPPER(TRIM('${regional.replace(/'/g, "''")}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
        SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${regional.replace(/'/g, "''")}'))
      ))`);
    }

    if (unidade) {
      if (useJoin) {
        whereConditions.push(`(UPPER(TRIM(COALESCE(ur.nmdepartamento, ''))) = UPPER(TRIM('${unidade.replace(/'/g, "''")}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${unidade.replace(/'/g, "''")}')) OR UPPER(TRIM(COALESCE(ur.nmdepartamento, ''))) LIKE UPPER(TRIM('%${unidade.replace(/'/g, "''")}%')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER(TRIM('%${unidade.replace(/'/g, "''")}%')))`);
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

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const joinClause = useJoin 
      ? `LEFT JOIN stg_unid_reg ur ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(ur.nmddepartamento, ur.nmd_departamento, '')))`
      : '';

    const query = `
      WITH colaboradores_base AS (
        SELECT 
          a.cpf as id,
          a.colaborador as nome,
          a.cpf,
          COALESCE(a.matricula, '') as matricula,
          COALESCE(NULLIF(TRIM(ur.nmdepartamento), ''), NULLIF(TRIM(a.unidade_hospitalar), ''), '') as unidade,
          COALESCE(NULLIF(TRIM(ur.regional_responsavel), ''), '') as regional,
          COALESCE(a.funcao,'') as funcao,
          CASE 
            WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::text
            WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')::text
            ELSE NULL
          END as "dataAdmissao"
        FROM stg_alterdata_v2 a
        ${joinClause}
        ${whereClause}
      )
      SELECT 
        cb.*,
        COALESCE(os.entregue, false) as "osEntregue",
        os.data_entrega::text as "dataEntregaOS",
        os.responsavel as "responsavelEntrega"
      FROM colaboradores_base cb
      LEFT JOIN ordem_servico os ON os.colaborador_cpf = cb.id
      ORDER BY 
        ${sortBy === 'nome' ? 'cb.nome' : 
          sortBy === 'unidade' ? 'cb.unidade' : 
          sortBy === 'regional' ? 'cb.regional' :
          sortBy === 'dataAdmissao' ? 'cb."dataAdmissao"' :
          'cb.nome'} ${sortDir.toUpperCase()}
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT a.cpf) as total
      FROM stg_alterdata_v2 a
      ${joinClause}
      ${whereClause}
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
        id: r.id,
        nome: r.nome,
        cpf: r.cpf,
        matricula: r.matricula,
        unidade: r.unidade,
        regional: r.regional,
        funcao: r.funcao,
        dataAdmissao: r.dataAdmissao,
        osEntregue: r.osEntregue || false,
        dataEntregaOS: r.dataEntregaOS,
        responsavelEntrega: r.responsavelEntrega,
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
