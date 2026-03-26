export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * API para executar a migração da tabela Acidente
 * ATENÇÃO: Esta rota deve ser protegida em produção!
 */
export async function POST(req: Request) {
  try {
    // Verifica se a tabela já existe
    const tableExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Acidente'
      ) AS exists
    `);

    if (tableExists[0]?.exists) {
      return NextResponse.json({
        ok: true,
        message: 'Tabela Acidente já existe',
        alreadyExists: true,
      });
    }

    // Executa a migração
    const migrationSQL = `
      -- CreateEnum
      DO $$ BEGIN
        CREATE TYPE "TipoAcidente" AS ENUM ('biologico', 'trajeto', 'tipico', 'de_trabalho', 'outros');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      -- CreateEnum
      DO $$ BEGIN
        CREATE TYPE "StatusAcidente" AS ENUM ('aberto', 'em_analise', 'concluido', 'cancelado');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      -- CreateEnum
      DO $$ BEGIN
        CREATE TYPE "EmpresaAcidente" AS ENUM ('IADVH', 'EMSERH');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      -- CreateTable
      CREATE TABLE IF NOT EXISTS "Acidente" (
          "id" TEXT NOT NULL,
          "nome" TEXT NOT NULL,
          "empresa" "EmpresaAcidente" NOT NULL,
          "unidadeHospitalar" TEXT NOT NULL,
          "regional" TEXT,
          "tipo" "TipoAcidente" NOT NULL,
          "comAfastamento" BOOLEAN NOT NULL DEFAULT false,
          "data" TIMESTAMP(3) NOT NULL,
          "hora" TEXT,
          "mes" INTEGER NOT NULL,
          "ano" INTEGER NOT NULL,
          "numeroCAT" TEXT,
          "riat" TEXT,
          "sinan" TEXT,
          "status" "StatusAcidente" NOT NULL DEFAULT 'aberto',
          "descricao" TEXT,
          "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "atualizadoEm" TIMESTAMP(3) NOT NULL,
          "criadoPor" TEXT,

          CONSTRAINT "Acidente_pkey" PRIMARY KEY ("id")
      );

      -- CreateIndex
      CREATE INDEX IF NOT EXISTS "Acidente_empresa_idx" ON "Acidente"("empresa");
      CREATE INDEX IF NOT EXISTS "Acidente_unidadeHospitalar_idx" ON "Acidente"("unidadeHospitalar");
      CREATE INDEX IF NOT EXISTS "Acidente_regional_idx" ON "Acidente"("regional");
      CREATE INDEX IF NOT EXISTS "Acidente_tipo_idx" ON "Acidente"("tipo");
      CREATE INDEX IF NOT EXISTS "Acidente_status_idx" ON "Acidente"("status");
      CREATE INDEX IF NOT EXISTS "Acidente_ano_mes_idx" ON "Acidente"("ano", "mes");
      CREATE INDEX IF NOT EXISTS "Acidente_data_idx" ON "Acidente"("data");
    `;

    await prisma.$executeRawUnsafe(migrationSQL);

    return NextResponse.json({
      ok: true,
      message: 'Tabela Acidente criada com sucesso!',
    });
  } catch (e: any) {
    console.error('[acidentes/migrate] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
