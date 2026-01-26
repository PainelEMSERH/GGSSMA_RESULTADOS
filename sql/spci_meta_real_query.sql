-- Query para calcular META e REAL de recarga de extintores
-- META: Quantos extintores precisam ser recarregados em cada mês (baseado em última recarga + 12 meses)
-- REAL: Quantos extintores foram realmente recarregados em cada mês (baseado em Data Execução Recarga)

-- Exemplo para Janeiro de 2026
-- META: Extintores que precisam ser recarregados em janeiro/2026
SELECT 
    'META JANEIRO 2026' AS tipo,
    COUNT(*) AS quantidade
FROM spci_planilha
WHERE 
    -- Usa Data Execução Recarga se existir, senão usa Última recarga
    COALESCE("Data Execução Recarga", "Última recarga") IS NOT NULL
    AND (
        -- Converte data DD/MM/YYYY para DATE e calcula vencimento (12 meses depois)
        -- Se a última recarga foi em 01/01/2025, o vencimento é 01/01/2026
        -- Então precisa recarregar em janeiro/2026
        (
            -- Última recarga + 12 meses cai em janeiro/2026
            (to_date(COALESCE("Data Execução Recarga", "Última recarga"), 'DD/MM/YYYY') + INTERVAL '12 months')::date
            BETWEEN '2026-01-01'::date AND '2026-01-31'::date
        )
        OR
        -- Se não tem data de recarga, considera que precisa recarregar
        (COALESCE("Data Execução Recarga", "Última recarga") IS NULL OR TRIM(COALESCE("Data Execução Recarga", "Última recarga")) = '')
    );

-- REAL: Extintores que foram realmente recarregados em janeiro/2026
SELECT 
    'REAL JANEIRO 2026' AS tipo,
    COUNT(*) AS quantidade
FROM spci_planilha
WHERE 
    "Data Execução Recarga" IS NOT NULL
    AND TRIM("Data Execução Recarga") != ''
    AND to_date("Data Execução Recarga", 'DD/MM/YYYY')::date
    BETWEEN '2026-01-01'::date AND '2026-01-31'::date;

-- Query completa para todos os meses de 2026
WITH extintores_base AS (
    SELECT 
        id,
        "Regional",
        "Última recarga",
        "Data Execução Recarga",
        -- Calcula data de vencimento (última recarga + 12 meses)
        CASE 
            WHEN COALESCE("Data Execução Recarga", "Última recarga") IS NOT NULL 
                 AND TRIM(COALESCE("Data Execução Recarga", "Última recarga")) != ''
            THEN (to_date(COALESCE("Data Execução Recarga", "Última recarga"), 'DD/MM/YYYY') + INTERVAL '12 months')::date
            ELSE NULL
        END AS data_vencimento,
        -- Data de execução da recarga (para REAL)
        CASE 
            WHEN "Data Execução Recarga" IS NOT NULL 
                 AND TRIM("Data Execução Recarga") != ''
            THEN to_date("Data Execução Recarga", 'DD/MM/YYYY')::date
            ELSE NULL
        END AS data_exec_recarga
    FROM spci_planilha
)
SELECT 
    mes,
    COUNT(*) FILTER (WHERE data_vencimento IS NOT NULL 
                     AND EXTRACT(YEAR FROM data_vencimento) = 2026
                     AND EXTRACT(MONTH FROM data_vencimento) = mes) AS meta,
    COUNT(*) FILTER (WHERE data_exec_recarga IS NOT NULL 
                     AND EXTRACT(YEAR FROM data_exec_recarga) = 2026
                     AND EXTRACT(MONTH FROM data_exec_recarga) = mes) AS real
FROM extintores_base
CROSS JOIN generate_series(1, 12) AS mes
GROUP BY mes
ORDER BY mes;
