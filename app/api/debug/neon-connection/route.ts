import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * API para verificar conexão com Neon e listar todas as tabelas e dados
 */
export async function GET() {
  try {
    // Testa conexão básica
    const connectionTest = await prisma.$queryRawUnsafe<any[]>(`SELECT 1 as test`);
    
    // Lista todas as tabelas do schema public
    const tables = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    // Para cada tabela importante, conta registros
    const tableCounts: Record<string, number> = {};
    const importantTables = [
      'stg_epi_map',
      'stg_alterdata_v2',
      'stg_unid_reg',
      'epi_entregas',
    ];

    for (const table of importantTables) {
      try {
        const count = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as total FROM ${table}`);
        tableCounts[table] = Number(count[0]?.total || 0);
      } catch (e) {
        tableCounts[table] = -1; // Tabela não existe
      }
    }

    // Verifica estrutura de stg_epi_map (se existir)
    let epiMapStructure: any = null;
    if (tableCounts['stg_epi_map'] >= 0) {
      try {
        epiMapStructure = await prisma.$queryRawUnsafe<any[]>(`
          SELECT 
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns
          WHERE table_name = 'stg_epi_map'
          ORDER BY ordinal_position
        `);
      } catch (e) {
        // Ignora
      }
    }

    // Pega amostras de stg_epi_map (se existir)
    let epiMapSamples: any[] = [];
    if (tableCounts['stg_epi_map'] > 0) {
      try {
        epiMapSamples = await prisma.$queryRawUnsafe<any[]>(`
          SELECT * FROM stg_epi_map LIMIT 5
        `);
      } catch (e) {
        // Ignora
      }
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      connectionTest: connectionTest[0]?.test === 1,
      allTables: tables,
      tableCounts,
      epiMapStructure,
      epiMapSamples,
      message: 'Conexão com Neon funcionando!',
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      connected: false,
      error: String(error?.message || error),
      message: 'Erro ao conectar com Neon. Verifique a DATABASE_URL no .env',
    }, { status: 500 });
  }
}
