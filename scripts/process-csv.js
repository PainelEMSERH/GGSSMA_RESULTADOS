// Script Node.js para processar CSV e gerar SQL
// Execute: node scripts/process-csv.js

const fs = require('fs');

const csvContent = `ALTERDATA;NORMALIZADO;ITEM;PCG;QUANTIDADE
ADVOGADO(A);ADVOGADO;SEM EPI;SEM MAPEAMENTO NO PCG;0
AGENTE DE PORTARIA;AGENTE DE PORTARIA;Máscara N95;PCG UNIVERSAL;1
...`; // Coloque o CSV completo aqui

const lines = csvContent.split('\n').filter(l => l.trim());
const header = lines[0].split(';');
const dataLines = lines.slice(1);

function escapeSql(str) {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

function parsePcg(pcg) {
  if (pcg === 'PCG UNIVERSAL' || pcg === 'SEM MAPEAMENTO NO PCG') {
    return { pcg: escapeSql(pcg), unidade: 'NULL' };
  }
  return { pcg: escapeSql(pcg), unidade: escapeSql(pcg) };
}

const inserts = dataLines.map(line => {
  const parts = line.split(';');
  if (parts.length < 5) return null;
  
  const alterdata = parts[0].trim();
  const normalizado = parts[1].trim();
  const item = parts[2].trim();
  const pcg = parts[3].trim();
  const quantidade = parseInt(parts[4].trim()) || 0;
  
  const { pcg: pcgSql, unidade } = parsePcg(pcg);
  
  return `(${escapeSql(alterdata)}, ${escapeSql(normalizado)}, ${escapeSql(item)}, ${quantidade}, ${pcgSql}, ${unidade}, NULL)`;
}).filter(Boolean);

const sql = `-- Script SQL gerado automaticamente
TRUNCATE TABLE stg_epi_map;

ALTER TABLE stg_epi_map ADD COLUMN IF NOT EXISTS funcao_normalizada TEXT;

INSERT INTO stg_epi_map (alterdata_funcao, funcao_normalizada, epi_item, quantidade, pcg, unidade_hospitalar, codigo_alterdata) VALUES
${inserts.join(',\n')};`;

fs.writeFileSync('scripts/import-epi-completo.sql', sql, 'utf8');
console.log('SQL gerado com sucesso!');
