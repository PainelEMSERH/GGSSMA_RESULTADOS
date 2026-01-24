-- ============================================
-- SCRIPT DE IMPORTAÇÃO COMPLETA DA BASE DE EPI
-- Copie e cole este script completo no Neon SQL Editor
-- ============================================

-- PASSO 1: Limpar tabela antiga
TRUNCATE TABLE stg_epi_map;

-- PASSO 2: Adicionar coluna funcao_normalizada se não existir
ALTER TABLE stg_epi_map 
ADD COLUMN IF NOT EXISTS funcao_normalizada TEXT;

-- PASSO 3: Inserir todos os dados
INSERT INTO stg_epi_map (alterdata_funcao, funcao_normalizada, epi_item, quantidade, pcg, unidade_hospitalar, codigo_alterdata) VALUES
