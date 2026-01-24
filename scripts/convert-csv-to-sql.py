#!/usr/bin/env python3
"""
Script para converter CSV de mapeamento de EPI em SQL INSERTs
Uso: python convert-csv-to-sql.py <arquivo.csv> > output.sql
"""

import csv
import sys
import re

def escape_sql_string(s):
    """Escapa string para SQL"""
    if s is None:
        return 'NULL'
    s = str(s).replace("'", "''")  # Escapa aspas simples
    return f"'{s}'"

def parse_pcg(pcg_value, unidade_value):
    """
    Interpreta o campo PCG:
    - "PCG UNIVERSAL" -> pcg='PCG UNIVERSAL', unidade_hospitalar=NULL, codigo_alterdata=NULL
    - "SEM MAPEAMENTO NO PCG" -> pcg='SEM MAPEAMENTO NO PCG', unidade_hospitalar=NULL, codigo_alterdata=NULL
    - Nome de unidade -> pcg=nome, unidade_hospitalar=nome, codigo_alterdata=NULL (será preenchido depois se necessário)
    """
    pcg_clean = pcg_value.strip() if pcg_value else ''
    
    if pcg_clean == 'PCG UNIVERSAL':
        return ('PCG UNIVERSAL', None, None)
    elif pcg_clean == 'SEM MAPEAMENTO NO PCG':
        return ('SEM MAPEAMENTO NO PCG', None, None)
    else:
        # É um nome de unidade específica
        unidade = pcg_clean if pcg_clean else None
        return (pcg_clean, unidade, None)

def main():
    if len(sys.argv) < 2:
        print("Uso: python convert-csv-to-sql.py <arquivo.csv>", file=sys.stderr)
        sys.exit(1)
    
    csv_file = sys.argv[1]
    
    print("-- Script SQL gerado automaticamente do CSV")
    print("-- Execute no Neon SQL Editor")
    print()
    print("TRUNCATE TABLE stg_epi_map;")
    print()
    print("ALTER TABLE stg_epi_map ADD COLUMN IF NOT EXISTS funcao_normalizada TEXT;")
    print()
    print("INSERT INTO stg_epi_map (alterdata_funcao, funcao_normalizada, epi_item, quantidade, pcg, unidade_hospitalar, codigo_alterdata) VALUES")
    
    rows = []
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            alterdata = row.get('ALTERDATA', '').strip()
            normalizado = row.get('NORMALIZADO', '').strip()
            item = row.get('ITEM', '').strip()
            pcg_raw = row.get('PCG', '').strip()
            quantidade = row.get('QUANTIDADE', '0').strip()
            
            # Pula linhas vazias
            if not alterdata or not normalizado:
                continue
            
            # Converte quantidade
            try:
                qty = int(quantidade) if quantidade else 0
            except:
                qty = 0
            
            # Interpreta PCG
            pcg, unidade, codigo = parse_pcg(pcg_raw, None)
            
            # Monta valores SQL
            values = (
                escape_sql_string(alterdata),
                escape_sql_string(normalizado),
                escape_sql_string(item),
                str(qty),
                escape_sql_string(pcg),
                escape_sql_string(unidade) if unidade else 'NULL',
                'NULL'  # codigo_alterdata será preenchido depois se necessário
            )
            
            rows.append(f"({', '.join(values)})")
    
    # Imprime todos os INSERTs
    for i, row_sql in enumerate(rows):
        if i < len(rows) - 1:
            print(row_sql + ',')
        else:
            print(row_sql + ';')
    
    print()
    print("-- Importação concluída!")

if __name__ == '__main__':
    main()
