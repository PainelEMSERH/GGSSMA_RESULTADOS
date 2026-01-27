import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * API de debug para verificar colaboradores com data de admissão 01/01/2026
 */
export async function GET(req: NextRequest) {
  try {
    const dataInicio = '2026-01-01';

    // Testa diferentes formatos de data
    const testQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN 1 END) as formato_iso,
        COUNT(CASE WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN 1 END) as formato_br,
        COUNT(CASE WHEN 
          CASE 
            WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::date
            WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')
            ELSE NULL
          END = '${dataInicio}'::date
        THEN 1 END) as com_data_01_01_2026
      FROM stg_alterdata_v2 a
    `;

    // Busca algumas amostras de datas de admissão
    const sampleQuery = `
      SELECT DISTINCT
        a.admissao,
        CASE 
          WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::date::text
          WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')::text
          ELSE NULL
        END as data_parseada,
        COUNT(*) as quantidade
      FROM stg_alterdata_v2 a
      WHERE a.admissao IS NOT NULL AND a.admissao != ''
      GROUP BY a.admissao
      ORDER BY quantidade DESC
      LIMIT 20
    `;

    // Busca colaboradores que podem ter iniciado em 01/01/2026
    const candidatesQuery = `
      SELECT 
        a.cpf,
        a.colaborador,
        a.admissao,
        CASE 
          WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::date::text
          WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')::text
          ELSE NULL
        END as data_parseada
      FROM stg_alterdata_v2 a
      WHERE (
        CASE 
          WHEN a.admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN a.admissao::date
          WHEN a.admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(a.admissao, 'DD/MM/YYYY')
          ELSE NULL
        END
      ) = '${dataInicio}'::date
      LIMIT 10
    `;

    const testResult: any[] = await prisma.$queryRawUnsafe(testQuery);
    const sampleResult: any[] = await prisma.$queryRawUnsafe(sampleQuery);
    const candidatesResult: any[] = await prisma.$queryRawUnsafe(candidatesQuery);

    return NextResponse.json({
      ok: true,
      estatisticas: testResult[0],
      amostras_datas: sampleResult,
      candidatos_01_01_2026: candidatesResult,
    });
  } catch (e: any) {
    console.error('[ordem-servico/debug] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
