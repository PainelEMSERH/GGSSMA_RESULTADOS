import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * API de teste para verificar se a tabela stg_epi_map foi importada corretamente
 */
export async function GET() {
  try {
    // Verifica se a tabela existe
    const tableExists = await prisma.$queryRawUnsafe<any[]>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_epi_map'
      ) AS exists
    `);

    if (!tableExists?.[0]?.exists) {
      return NextResponse.json({
        ok: false,
        error: 'Tabela stg_epi_map não existe',
        total: 0,
      });
    }

    // Conta total de registros
    const total = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*) as total FROM stg_epi_map
    `);

    // Verifica se tem a coluna funcao_normalizada
    const hasNormalized = await prisma.$queryRawUnsafe<any[]>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stg_epi_map' AND column_name = 'funcao_normalizada'
      ) AS exists
    `);

    // Pega alguns exemplos
    const samples = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        alterdata_funcao,
        funcao_normalizada,
        epi_item,
        quantidade,
        pcg,
        unidade_hospitalar
      FROM stg_epi_map
      LIMIT 10
    `);

    // Conta por tipo de PCG
    const byPcg = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        pcg,
        COUNT(*) as total
      FROM stg_epi_map
      GROUP BY pcg
      ORDER BY total DESC
      LIMIT 10
    `);

    // Conta funções únicas
    const uniqueFunctions = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(DISTINCT COALESCE(funcao_normalizada, alterdata_funcao)) as total
      FROM stg_epi_map
    `);

    return NextResponse.json({
      ok: true,
      total: Number(total[0]?.total || 0),
      hasNormalizedColumn: hasNormalized[0]?.exists || false,
      uniqueFunctions: Number(uniqueFunctions[0]?.total || 0),
      samples: samples,
      byPcg: byPcg,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: String(error?.message || error),
    }, { status: 500 });
  }
}
