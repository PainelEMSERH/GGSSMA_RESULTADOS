-- CreateEnum
CREATE TYPE "TipoAcidente" AS ENUM ('biologico', 'trajeto', 'tipico', 'de_trabalho', 'outros');

-- CreateEnum
CREATE TYPE "StatusAcidente" AS ENUM ('aberto', 'em_analise', 'concluido', 'cancelado');

-- CreateEnum
CREATE TYPE "EmpresaAcidente" AS ENUM ('IADVH', 'EMSERH');

-- CreateTable
CREATE TABLE "Acidente" (
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
CREATE INDEX "Acidente_empresa_idx" ON "Acidente"("empresa");

-- CreateIndex
CREATE INDEX "Acidente_unidadeHospitalar_idx" ON "Acidente"("unidadeHospitalar");

-- CreateIndex
CREATE INDEX "Acidente_regional_idx" ON "Acidente"("regional");

-- CreateIndex
CREATE INDEX "Acidente_tipo_idx" ON "Acidente"("tipo");

-- CreateIndex
CREATE INDEX "Acidente_status_idx" ON "Acidente"("status");

-- CreateIndex
CREATE INDEX "Acidente_ano_mes_idx" ON "Acidente"("ano", "mes");

-- CreateIndex
CREATE INDEX "Acidente_data_idx" ON "Acidente"("data");
