-- View Materializada Otimizada para Alterdata
-- Esta view pré-processa todos os dados JSONB em colunas planas
-- MUITO mais rápido que processar JSONB toda vez

-- 1. Cria a view materializada com dados já processados
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_alterdata_v2_raw_flat AS
SELECT 
  r.row_no,
  r.batch_id,
  r.imported_at,
  -- Extrai todas as colunas do JSONB de uma vez
  r.data->>'CPF' as cpf,
  r.data->>'Matrícula' as matricula,
  r.data->>'Colaborador' as colaborador,
  r.data->>'Unidade Hospitalar' as unidade_hospitalar,
  r.data->>'Função' as funcao,
  r.data->>'Admissão' as admissao,
  r.data->>'Demissão' as demissao,
  r.data->>'Nmdepartamento' as nmdepartamento,
  r.data->>'Cdchamada' as cdchamada,
  -- Mantém o JSONB completo para colunas dinâmicas
  r.data as data_jsonb
FROM stg_alterdata_v2_raw r;

-- 2. Cria índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_mv_alterdata_raw_flat_batch ON mv_alterdata_v2_raw_flat (batch_id);
CREATE INDEX IF NOT EXISTS idx_mv_alterdata_raw_flat_row_no ON mv_alterdata_v2_raw_flat (row_no);
CREATE INDEX IF NOT EXISTS idx_mv_alterdata_raw_flat_cpf ON mv_alterdata_v2_raw_flat (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mv_alterdata_raw_flat_unidade ON mv_alterdata_v2_raw_flat (unidade_hospitalar) WHERE unidade_hospitalar IS NOT NULL;

-- 3. Atualiza estatísticas
ANALYZE mv_alterdata_v2_raw_flat;

-- IMPORTANTE: Após cada importação, execute:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_alterdata_v2_raw_flat;
-- ANALYZE mv_alterdata_v2_raw_flat;
