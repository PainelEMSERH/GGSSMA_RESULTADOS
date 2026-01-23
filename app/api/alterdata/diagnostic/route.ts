export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Conta registros na tabela raw (todos os que foram importados)
    const rawCount: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2_raw
    `);

    // Conta registros na tabela processada
    const processedCount: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2
    `);

    // Conta registros sem CPF na tabela raw
    const noCpfRaw: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2_raw
      WHERE data->>'CPF' IS NULL 
         OR data->>'CPF' = ''
         OR regexp_replace(data->>'CPF', '[^0-9]', '', 'g') = ''
    `);

    // Conta registros sem CPF na tabela processada
    const noCpfProcessed: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2
      WHERE cpf IS NULL OR cpf = ''
    `);

    // Conta duplicatas (mesmo CPF + Matrícula)
    const duplicates: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*)::int AS total_rows,
        COUNT(DISTINCT (cpf, matricula))::int AS unique_keys
      FROM stg_alterdata_v2
      WHERE cpf IS NOT NULL AND cpf != ''
    `);

    // Últimas importações
    const lastImports: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        batch_id,
        source_file,
        total_rows,
        imported_by,
        imported_at
      FROM stg_alterdata_v2_imports
      ORDER BY imported_at DESC
      LIMIT 5
    `);

    // Registros que não foram processados (têm CPF mas não estão na tabela processada)
    const notProcessed: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2_raw r
      WHERE r.batch_id IN (
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      )
      AND (
        regexp_replace(r.data->>'CPF', '[^0-9]', '', 'g') IS NOT NULL
        AND regexp_replace(r.data->>'CPF', '[^0-9]', '', 'g') != ''
      )
      AND NOT EXISTS (
        SELECT 1 FROM stg_alterdata_v2 p
        WHERE regexp_replace(r.data->>'CPF', '[^0-9]', '', 'g') = p.cpf
        AND COALESCE(NULLIF(r.data->>'Matrícula',''), md5(COALESCE(r.data->>'Colaborador',''))) = p.matricula
      )
    `);

    return NextResponse.json({
      ok: true,
      diagnostic: {
        raw_total: Number(rawCount?.[0]?.total || 0),
        processed_total: Number(processedCount?.[0]?.total || 0),
        raw_no_cpf: Number(noCpfRaw?.[0]?.total || 0),
        processed_no_cpf: Number(noCpfProcessed?.[0]?.total || 0),
        duplicates: {
          total_rows: Number(duplicates?.[0]?.total_rows || 0),
          unique_keys: Number(duplicates?.[0]?.unique_keys || 0),
          duplicates_count: Number(duplicates?.[0]?.total_rows || 0) - Number(duplicates?.[0]?.unique_keys || 0),
        },
        not_processed: Number(notProcessed?.[0]?.total || 0),
        last_imports: (lastImports || []).map((imp: any) => ({
          batch_id: imp.batch_id,
          source_file: imp.source_file,
          total_rows: Number(imp.total_rows || 0),
          imported_by: imp.imported_by,
          imported_at: imp.imported_at,
        })),
        difference: Number(rawCount?.[0]?.total || 0) - Number(processedCount?.[0]?.total || 0),
      },
    });
  } catch (e: any) {
    console.error('[alterdata/diagnostic] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
