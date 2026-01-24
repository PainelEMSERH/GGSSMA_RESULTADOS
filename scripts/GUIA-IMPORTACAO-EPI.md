# Guia de Importação da Nova Base de EPI

## Opção 1: Importador CSV do Neon (RECOMENDADO - Mais Fácil)

1. **Acesse o Neon Dashboard**
   - Vá para sua base de dados
   - Clique em "Tables" > "stg_epi_map"

2. **Use o Importador**
   - Procure o botão "Import" ou "Upload CSV"
   - Selecione seu arquivo CSV
   - Configure:
     - **Delimiter:** `;` (ponto e vírgula)
     - **Header:** Sim
     - **Encoding:** UTF-8

3. **Mapeie as Colunas:**
   - `ALTERDATA` → `alterdata_funcao`
   - `NORMALIZADO` → `funcao_normalizada` (nova coluna)
   - `ITEM` → `epi_item`
   - `QUANTIDADE` → `quantidade`
   - `PCG` → `pcg`

4. **Tratamento Especial do PCG:**
   - Se `PCG = "PCG UNIVERSAL"` → `unidade_hospitalar = NULL`
   - Se `PCG = "SEM MAPEAMENTO NO PCG"` → `unidade_hospitalar = NULL`
   - Se `PCG = Nome de Unidade` → `unidade_hospitalar = Nome da Unidade`

5. **Execute a Importação**

---

## Opção 2: Script SQL Manual

Se o importador não funcionar, você pode:

1. **Salvar o CSV que você me enviou** em um arquivo (ex: `epi-map.csv`)

2. **Executar no Neon SQL Editor:**
   ```sql
   -- Limpar tabela
   TRUNCATE TABLE stg_epi_map;
   
   -- Adicionar coluna normalizada
   ALTER TABLE stg_epi_map 
   ADD COLUMN IF NOT EXISTS funcao_normalizada TEXT;
   ```

3. **Usar COPY (se o Neon suportar):**
   ```sql
   COPY stg_epi_map (alterdata_funcao, funcao_normalizada, epi_item, quantidade, pcg, unidade_hospitalar)
   FROM 'caminho/para/epi-map.csv'
   WITH (FORMAT csv, DELIMITER ';', HEADER true);
   ```

---

## Opção 3: Script Python (Se você tiver Python instalado)

1. Salve o CSV como `epi-map.csv`
2. Execute:
   ```bash
   python scripts/convert-csv-to-sql.py epi-map.csv > import.sql
   ```
3. Execute o `import.sql` no Neon

---

## Após a Importação

Depois de importar, verifique:

```sql
-- Ver quantos registros foram importados
SELECT COUNT(*) FROM stg_epi_map;

-- Ver exemplos
SELECT * FROM stg_epi_map LIMIT 10;

-- Verificar funções normalizadas
SELECT DISTINCT funcao_normalizada FROM stg_epi_map ORDER BY funcao_normalizada;
```

---

## Importante

- **Backup:** Faça backup da tabela `stg_epi_map` antes de limpar!
- **Teste:** Teste com algumas linhas primeiro antes de importar tudo
- **Validação:** Verifique se os dados estão corretos após a importação
