-- Script de Importação da Nova Base de Mapeamento de EPI
-- Execute este script no Neon SQL Editor

-- PASSO 1: Limpar a tabela antiga (CUIDADO: Isso apaga tudo!)
TRUNCATE TABLE stg_epi_map;

-- PASSO 2: Adicionar coluna funcao_normalizada se não existir
ALTER TABLE stg_epi_map 
ADD COLUMN IF NOT EXISTS funcao_normalizada TEXT;

-- PASSO 3: Inserir os dados
-- Nota: Este script assume que você vai importar via CSV ou copiar os dados manualmente
-- Se preferir, posso criar um script que você executa linha por linha, ou um script Python

-- Exemplo de INSERT (primeiras linhas):
INSERT INTO stg_epi_map (alterdata_funcao, funcao_normalizada, epi_item, quantidade, pcg, unidade_hospitalar, codigo_alterdata) VALUES
('ADVOGADO(A)', 'ADVOGADO', 'SEM EPI', 0, 'SEM MAPEAMENTO NO PCG', NULL, NULL),
('AGENTE DE PORTARIA', 'AGENTE DE PORTARIA', 'Máscara N95', 1, 'PCG UNIVERSAL', NULL, NULL),
('ANALISTA ADMINISTRATIVO', 'ANALISTA ADMINISTRATIVO', 'Máscara N95', 1, 'PCG UNIVERSAL', NULL, NULL),
('ANALISTA CSL', 'ANALISTA CSL', 'SEM EPI', 0, 'SEM MAPEAMENTO NO PCG', NULL, NULL),
('ANALISTA DE ABASTECIMENTO', 'ANALISTA DE ABASTECIMENTO', 'Máscara N95', 1, 'CENTRAL DE ABASTECIMENTO HOSPITALAR - CAHOSP', 'CENTRAL DE ABASTECIMENTO HOSPITALAR - CAHOSP', NULL);

-- IMPORTANTE: Para importar o CSV completo, você tem 3 opções:
-- 1. Usar o importador CSV do Neon (recomendado)
-- 2. Converter para INSERTs SQL (vou criar um script Python para isso)
-- 3. Usar COPY FROM (se o Neon suportar)
