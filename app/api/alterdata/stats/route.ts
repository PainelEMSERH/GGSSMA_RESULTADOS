export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Conta colaboradores na base Alterdata
    const alterdataCount: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2
      WHERE cpf IS NOT NULL AND cpf != ''
    `);

    // Conta colaboradores manuais
    const manualCount: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM epi_manual_colab
      WHERE cpf IS NOT NULL AND cpf != ''
    `);

    // Última importação
    const lastImport: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        batch_id,
        source_file,
        total_rows,
        imported_by,
        imported_at
      FROM stg_alterdata_v2_imports
      ORDER BY imported_at DESC
      LIMIT 1
    `);

    // Total único (considerando que pode haver duplicatas entre alterdata e manual)
    const uniqueCount: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT cpf)::int AS total
      FROM (
        SELECT cpf FROM stg_alterdata_v2 WHERE cpf IS NOT NULL AND cpf != ''
        UNION
        SELECT cpf FROM epi_manual_colab WHERE cpf IS NOT NULL AND cpf != ''
      ) AS combined
    `);

    // Colaboradores ativos (sem demissão ou demitidos após 2025-01-01)
    const activeCount: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2
      WHERE cpf IS NOT NULL AND cpf != ''
        AND (
          demissao IS NULL 
          OR demissao = '' 
          OR CASE
            WHEN demissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(demissao, 'YYYY-MM-DD') >= '2025-01-01'::date
            WHEN demissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(demissao, 'DD/MM/YYYY') >= '2025-01-01'::date
            ELSE true
          END
        )
    `);

    return NextResponse.json({
      ok: true,
      stats: {
        total_alterdata: Number(alterdataCount?.[0]?.total || 0),
        total_manual: Number(manualCount?.[0]?.total || 0),
        total_unique: Number(uniqueCount?.[0]?.total || 0),
        total_active: Number(activeCount?.[0]?.total || 0),
        last_import: lastImport?.[0] ? {
          batch_id: lastImport[0].batch_id,
          source_file: lastImport[0].source_file,
          total_rows: Number(lastImport[0].total_rows || 0),
          imported_by: lastImport[0].imported_by,
          imported_at: lastImport[0].imported_at,
        } : null,
      },
    });
  } catch (e: any) {
    console.error('[alterdata/stats] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
