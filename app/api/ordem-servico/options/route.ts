import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * API para buscar opções de filtros (regionais, unidades)
 */
export async function GET(req: NextRequest) {
  try {
    const dataInicio = '2026-01-01';

    // Busca regionais
    const regionaisQuery = `
      SELECT DISTINCT
        COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                 WHERE COALESCE(ur.nmddepartamento, ur.nmd_departamento) = a.unidade_hospitalar 
                 LIMIT 1),'') as regional
      FROM stg_alterdata_v2 a
      WHERE (
        CASE 
          WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::date
          WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')
          ELSE NULL
        END
      ) = '${dataInicio}'::date
        AND (a.demissao IS NULL OR 
          CASE 
            WHEN a.demissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.demissao::date
            WHEN a.demissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.demissao, 'DD/MM/YYYY')
            ELSE NULL
          END > NOW()::date OR a.demissao = '' OR TRIM(a.demissao) = '')
        AND COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                     WHERE COALESCE(ur.nmddepartamento, ur.nmd_departamento) = a.unidade_hospitalar 
                     LIMIT 1),'') != ''
      ORDER BY regional
    `;

    // Busca unidades
    const unidadesQuery = `
      SELECT DISTINCT
        COALESCE(a.unidade_hospitalar,'') as unidade,
        COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                 WHERE COALESCE(ur.nmddepartamento, ur.nmd_departamento) = a.unidade_hospitalar 
                 LIMIT 1),'') as regional
      FROM stg_alterdata_v2 a
      WHERE (
        CASE 
          WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::date
          WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')
          ELSE NULL
        END
      ) = '${dataInicio}'::date
        AND (a.demissao IS NULL OR 
          CASE 
            WHEN a.demissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.demissao::date
            WHEN a.demissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.demissao, 'DD/MM/YYYY')
            ELSE NULL
          END > NOW()::date OR a.demissao = '' OR TRIM(a.demissao) = '')
        AND COALESCE(a.unidade_hospitalar,'') != ''
      ORDER BY regional, unidade
    `;

    const regionaisResult: any[] = await prisma.$queryRawUnsafe(regionaisQuery);
    const unidadesResult: any[] = await prisma.$queryRawUnsafe(unidadesQuery);

    const regionais = regionaisResult
      .map((r) => r.regional)
      .filter((r) => r && r.trim() !== '')
      .sort();

    const unidades = unidadesResult
      .map((r) => ({
        unidade: r.unidade,
        regional: r.regional || '',
      }))
      .filter((u) => u.unidade && u.unidade.trim() !== '');

    return NextResponse.json({
      ok: true,
      regionais,
      unidades,
    });
  } catch (e: any) {
    console.error('[ordem-servico/options] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
