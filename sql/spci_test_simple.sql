-- Query de teste simples para verificar se a tabela está acessível
-- Execute esta query e me diga o resultado

-- Teste 1: Conta total
SELECT COUNT(*) AS total FROM spci_planilha;

-- Teste 2: Busca 3 registros simples (sem colunas problemáticas)
SELECT 
    "TAG",
    "Unidade",
    "Regional"
FROM spci_planilha
LIMIT 3;

-- Teste 3: Verifica se a coluna ID existe e tem valores
SELECT 
    COUNT(*) AS total,
    COUNT("ID") AS com_id,
    COUNT(*) - COUNT("ID") AS sem_id
FROM spci_planilha;
