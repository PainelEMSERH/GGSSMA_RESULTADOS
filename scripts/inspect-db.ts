
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Iniciando inspeção do banco de dados Neon...');

  try {
    // 1. Buscar unidades distintas no stg_epi_map
    console.log('📦 Lendo stg_epi_map...');
    const epiMapUnits = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT unidade_hospitalar, codigo_alterdata 
      FROM stg_epi_map 
      ORDER BY unidade_hospitalar ASC
    `);

    // 2. Buscar unidades no stg_unid_reg (se existir)
    console.log('🏢 Lendo stg_unid_reg...');
    let unidRegUnits: any[] = [];
    try {
      unidRegUnits = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM stg_unid_reg
      `);
    } catch (e) {
      console.log('⚠️ stg_unid_reg não encontrada ou erro ao ler.');
    }

    // 3. Buscar unidades no stg_alterdata_v2 (amostra)
    console.log('👥 Lendo amostra de stg_alterdata_v2...');
    let alterdataUnits: any[] = [];
    try {
      alterdataUnits = await prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT unidade_hospitalar 
        FROM stg_alterdata_v2 
        WHERE unidade_hospitalar IS NOT NULL
        ORDER BY unidade_hospitalar ASC
      `);
    } catch (e) {
      console.log('⚠️ stg_alterdata_v2 não encontrada ou erro ao ler.');
    }

    const output = {
      timestamp: new Date().toISOString(),
      stg_epi_map: epiMapUnits,
      stg_unid_reg: unidRegUnits,
      stg_alterdata_v2: alterdataUnits
    };

    // Salvar em arquivo
    const outDir = path.join(process.cwd(), 'debug');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir);
    }
    const outFile = path.join(outDir, 'db_dump.json');
    fs.writeFileSync(outFile, JSON.stringify(output, null, 2));

    console.log(`✅ Inspeção concluída! Dados salvos em: ${outFile}`);
    console.log(`📊 Resumo:`);
    console.log(`   - stg_epi_map: ${epiMapUnits.length} unidades encontradas`);
    console.log(`   - stg_unid_reg: ${unidRegUnits.length} registros`);
    console.log(`   - stg_alterdata_v2: ${alterdataUnits.length} unidades distintas`);

  } catch (error) {
    console.error('❌ Erro fatal na inspeção:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
