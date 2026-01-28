export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as sql from 'mssql';

const sqlServerConfig: sql.config = {
  server: '192.168.176.5\\ALTERDATA',
  database: 'ALTERDATA_PACK',
  user: 'DESSMA',
  password: '#De$Ma2024!',
  options: {
    encrypt: false,
  },
};

/**
 * GET /api/alterdata/diagnostic
 * Mostra a estrutura da tabela wdp.CAT para ajustar o mapeamento
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    let pool: sql.ConnectionPool | null = null;

    try {
      pool = await sql.connect(sqlServerConfig);

      // Pega estrutura da tabela
      const columnsResult = await pool.request().query(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'wdp' AND TABLE_NAME = 'CAT'
        ORDER BY ORDINAL_POSITION
      `);

      // Pega uma amostra de dados (primeira linha)
      const sampleResult = await pool.request().query('SELECT TOP 1 * FROM wdp.CAT');
      const sampleRow = sampleResult.recordset[0] || {};

      // Conta total de registros
      const countResult = await pool.request().query('SELECT COUNT(*) as total FROM wdp.CAT');
      const total = countResult.recordset[0]?.total || 0;

      return NextResponse.json({
        ok: true,
        columns: columnsResult.recordset,
        sampleRow,
        total,
        message: 'Estrutura da tabela wdp.CAT obtida com sucesso',
      });
    } catch (e: any) {
      console.error('[diagnostic] erro:', e);
      return NextResponse.json(
        {
          ok: false,
          error: `Erro ao conectar ao SQL Server: ${e?.message || String(e)}`,
        },
        { status: 500 }
      );
    } finally {
      if (pool) {
        try {
          await pool.close();
        } catch (e) {
          console.error('[diagnostic] erro ao fechar conexão:', e);
        }
      }
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `Erro interno: ${e?.message || String(e)}` },
      { status: 500 }
    );
  }
}
