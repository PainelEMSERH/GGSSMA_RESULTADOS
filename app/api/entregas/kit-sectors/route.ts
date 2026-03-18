export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findBestFunctionMatch } from '@/lib/functionMatcher';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const funcaoRaw = (searchParams.get('funcao') || '').trim();
    if (!funcaoRaw) return NextResponse.json({ ok: true, sectors: [] });

    // Base de funções para usar a mesma lógica do /api/entregas/kit
    const allFunctionsRaw: any[] = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT COALESCE(funcao_normalizada, alterdata_funcao) AS func_name
      FROM stg_epi_map
      WHERE alterdata_funcao IS NOT NULL
    `);

    const allFunctions = (allFunctionsRaw || []).map((r) => r?.func_name).filter(Boolean);
    const matchedFunc = findBestFunctionMatch(funcaoRaw, allFunctions) || funcaoRaw;

    // “Setores” = unidade_hospitalar no EPI map, excluindo universal e sentinelas.
    const sectorsRows: any[] = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT DISTINCT TRIM(COALESCE(unidade_hospitalar, '')) AS unidade_hospitalar
        FROM stg_epi_map
        WHERE TRIM(COALESCE(unidade_hospitalar, '')) <> ''
          AND TRIM(COALESCE(unidade_hospitalar, '')) NOT IN ('PCG UNIVERSAL', 'SEM MAPEAMENTO NO PCG')
          AND (
            UPPER(TRIM(COALESCE(funcao_normalizada, ''))) = UPPER(TRIM($1))
            OR UPPER(TRIM(COALESCE(alterdata_funcao, ''))) = UPPER(TRIM($2))
          )
        ORDER BY unidade_hospitalar ASC
      `,
      matchedFunc,
      funcaoRaw,
    );

    const sectors = (sectorsRows || []).map((r) => String(r?.unidade_hospitalar || '').trim()).filter(Boolean);
    if (sectors.length > 0) {
      return NextResponse.json({ ok: true, sectors });
    }

    // Fallback: tenta match "contém" para lidar com variações de escrita.
    const like = `%${funcaoRaw}%`;
    const fallbackRows: any[] = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT DISTINCT TRIM(COALESCE(unidade_hospitalar, '')) AS unidade_hospitalar
        FROM stg_epi_map
        WHERE TRIM(COALESCE(unidade_hospitalar, '')) <> ''
          AND TRIM(COALESCE(unidade_hospitalar, '')) NOT IN ('PCG UNIVERSAL', 'SEM MAPEAMENTO NO PCG')
          AND (
            UPPER(TRIM(COALESCE(funcao_normalizada, ''))) LIKE UPPER(TRIM($1))
            OR UPPER(TRIM(COALESCE(alterdata_funcao, ''))) LIKE UPPER(TRIM($1))
          )
        ORDER BY unidade_hospitalar ASC
      `,
      like,
    );

    const fallbackSectors = (fallbackRows || [])
      .map((r) => String(r?.unidade_hospitalar || '').trim())
      .filter(Boolean);

    return NextResponse.json({ ok: true, sectors: fallbackSectors });
  } catch (e: any) {
    console.error('[kit-sectors] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e), sectors: [] }, { status: 500 });
  }
}

