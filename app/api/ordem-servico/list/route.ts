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
    let whereConditions: string[] = [];
    whereConditions.push(`a.admissao::date = '${dataInicio}'::date`);
    whereConditions.push(`(a.demissao IS NULL OR a.demissao::date > NOW()::date)`);

    if (regional) {
      whereConditions.push(`md5(COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                        WHERE COALESCE(ur.nmddepartamento, ur.nmd_departamento) = a.unidade_hospitalar 
                        LIMIT 1),'')) = '${regional.replace(/'/g, "''")}'`);
    }

    if (unidade) {
      whereConditions.push(`md5(COALESCE(a.unidade_hospitalar,'')) = '${unidade.replace(/'/g, "''")}'`);
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

    // Busca dados de entrega de OS
    const query = `
      WITH colaboradores_base AS (
        SELECT 
          a.cpf as id,
          a.colaborador as nome,
          a.cpf,
          a.matricula,
          COALESCE(a.unidade_hospitalar,'') as unidade,
          COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                   WHERE COALESCE(ur.nmddepartamento, ur.nmd_departamento) = a.unidade_hospitalar 
                   LIMIT 1),'') as regional,
          COALESCE(a.funcao,'') as funcao,
          CASE 
            WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::text
            WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')::text
            ELSE NULL
          END as "dataAdmissao"
        FROM stg_alterdata_v2 a
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
      SELECT COUNT(*) as total
      FROM stg_alterdata_v2 a
      ${whereClause}
    `;

    // Executa queries
    const rows: any[] = await prisma.$queryRawUnsafe(query);
    const countResult: any[] = await prisma.$queryRawUnsafe(countQuery);
    const total = parseInt(countResult[0]?.total || '0', 10);

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
