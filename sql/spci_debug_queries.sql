-- ============================================
-- QUERIES DE DEBUG PARA SPCI
-- Execute estas queries no Neon e me envie os resultados
-- ============================================

-- 1. Verifica se a tabela existe e quantos registros tem
SELECT 
    COUNT(*)::int AS total_registros,
    COUNT(DISTINCT "TAG")::int AS tags_unicas,
    COUNT(DISTINCT "Unidade")::int AS unidades_unicas,
    COUNT(DISTINCT "Regional")::int AS regionais_unicas
FROM spci_planilha;

-- 2. Mostra a estrutura da tabela (colunas e tipos)
SELECT 
    column_name,
    data_type,
    is_nullable,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'spci_planilha'
ORDER BY ordinal_position;

-- 3. Mostra 5 registros de exemplo (primeiros registros)
SELECT 
    "ID",
    "Ano do Planejamento",
    "TAG",
    "Unidade",
    "Regional",
    "Classe",
    "Última recarga",
    "Possui Contrato",
    "Status"
FROM spci_planilha
ORDER BY "ID"
LIMIT 5;

-- 4. Lista todas as Regionais únicas
SELECT DISTINCT "Regional"
FROM spci_planilha
WHERE "Regional" IS NOT NULL AND "Regional" != ''
ORDER BY "Regional";

-- 5. Lista todas as Unidades únicas (primeiras 20)
SELECT DISTINCT "Unidade"
FROM spci_planilha
WHERE "Unidade" IS NOT NULL AND "Unidade" != ''
ORDER BY "Unidade"
LIMIT 20;

-- 6. Lista todas as Classes únicas
SELECT DISTINCT "Classe"
FROM spci_planilha
WHERE "Classe" IS NOT NULL AND "Classe" != ''
ORDER BY "Classe";

-- 7. Lista todos os Anos de Planejamento únicos
SELECT DISTINCT "Ano do Planejamento"
FROM spci_planilha
WHERE "Ano do Planejamento" IS NOT NULL
ORDER BY "Ano do Planejamento" DESC;

-- 8. Verifica se há problemas com espaços ou caracteres especiais nos nomes
SELECT 
    "Unidade",
    LENGTH("Unidade") AS tamanho,
    TRIM("Unidade") AS unidade_trimmed,
    UPPER("Unidade") AS unidade_upper
FROM spci_planilha
WHERE "Unidade" IS NOT NULL
GROUP BY "Unidade"
ORDER BY "Unidade"
LIMIT 10;

-- 9. Testa a query que a API usa (sem filtros)
SELECT 
    "ID",
    "Ano do Planejamento",
    "TAG",
    "Unidade",
    "Local",
    "Regional",
    "Classe",
    "Massa/Volume (kg/L)",
    "TAG de Controle Mensal",
    "Data Tagueamento",
    "Lote Contrato",
    "Possui Contrato",
    "Nome da Contratada",
    "Nº série (Selo INMETRO)",
    "Última recarga",
    "Planej. Recarga",
    "Data Execução Recarga"
FROM spci_planilha
ORDER BY "TAG"
LIMIT 10;

-- 10. Verifica valores de "Possui Contrato"
SELECT 
    "Possui Contrato",
    COUNT(*)::int AS quantidade
FROM spci_planilha
WHERE "Possui Contrato" IS NOT NULL
GROUP BY "Possui Contrato"
ORDER BY "Possui Contrato";
