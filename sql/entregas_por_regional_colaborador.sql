-- Entregas por regional e colaborador (Leste, Centro, Norte)
-- Uma única regional por CPF: usa a primeira unidade encontrada em stg_alterdata_v2
-- para evitar a mesma pessoa aparecer em regionais diferentes por causa de múltiplas linhas na base.

WITH cpf_regional AS (
  SELECT DISTINCT ON (regexp_replace(COALESCE(TRIM(a.cpf), ''), '[^0-9]', '', 'g'))
    regexp_replace(COALESCE(TRIM(a.cpf), ''), '[^0-9]', '', 'g') AS cpf_limpo,
    COALESCE(TRIM(u.regional_responsavel), 'Sem regional') AS regional,
    TRIM(COALESCE(a.colaborador, '')) AS nome_colaborador
  FROM stg_alterdata_v2 a
  LEFT JOIN stg_unid_reg u
    ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
  WHERE regexp_replace(COALESCE(TRIM(a.cpf), ''), '[^0-9]', '', 'g') <> ''
  ORDER BY regexp_replace(COALESCE(TRIM(a.cpf), ''), '[^0-9]', '', 'g'),
           COALESCE(TRIM(u.regional_responsavel), 'Sem regional'),
           a.unidade_hospitalar
)
SELECT
  r.regional,
  r.nome_colaborador,
  e.cpf,
  COUNT(*) AS quantidade_linhas,
  SUM(e.qty_delivered)::int AS itens_entregues
FROM epi_entregas e
JOIN cpf_regional r
  ON regexp_replace(COALESCE(TRIM(e.cpf), ''), '[^0-9]', '', 'g') = r.cpf_limpo
WHERE e.qty_delivered > 0
  AND UPPER(TRIM(r.regional)) IN ('LESTE', 'CENTRO', 'NORTE')
GROUP BY r.regional, r.nome_colaborador, e.cpf
ORDER BY r.regional, r.nome_colaborador;
