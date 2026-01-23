# 📥 Como Importar as Bases de Dados

## Sistema de Importação Criado ✅

Criei um sistema completo de importação que funciona **diretamente pela interface web**, igual ao sistema de importação do Alterdata que você já usa.

## Como Funciona

### 1. Acesse a Página de Importação
- Vá em **Admin → Importar Outras Bases**
- Ou acesse diretamente: `/admin/importar-bases`

### 2. Selecione o Módulo
Escolha qual base você quer importar:
- 🔥 **SPCI - Extintores**
- 👥 **CIPA**
- ⚠️ **Acidentes**
- 🔧 **Ordens de Serviço**

### 3. Envie o Arquivo
- Formato aceito: **Excel (.xlsx)** ou **CSV**
- O sistema processa automaticamente e salva no banco Neon

## Estrutura Esperada dos Arquivos

### 🔥 SPCI - Extintores
Colunas esperadas (pode ter nomes variados, o sistema reconhece):
- **Unidade** (ou unidade, UNIDADE)
- **Regional** (ou regional, REGIONAL)
- **Tipo de Extintor** (ou Tipo Extintor, tipo_extintor)
- **Capacidade**
- **Localização** (ou Localizacao, localizacao)
- **Data Vencimento** (formato: DD/MM/YYYY ou YYYY-MM-DD)
- **Última Inspeção** (formato: DD/MM/YYYY ou YYYY-MM-DD)
- **Próxima Inspeção** (formato: DD/MM/YYYY ou YYYY-MM-DD)
- **Status**
- **Número de Série** (opcional)
- **Fabricante** (opcional)
- **Observações** (opcional)

### 👥 CIPA
Colunas esperadas:
- **Nome**
- **CPF** (aceita com ou sem formatação)
- **Função** (ou Funcao, funcao)
- **Unidade**
- **Cargo na CIPA** (ou Cargo CIPA, cargo_cipa)
- **Data Eleição** (formato: DD/MM/YYYY ou YYYY-MM-DD)
- **Data Fim Mandato** (formato: DD/MM/YYYY ou YYYY-MM-DD)
- **Status**
- **Telefone** (opcional)
- **Email** (opcional)
- **Observações** (opcional)

### ⚠️ Acidentes
Colunas esperadas:
- **Data do Acidente** (formato: DD/MM/YYYY ou YYYY-MM-DD)
- **Nome** (ou Colaborador, nome)
- **CPF** (aceita com ou sem formatação)
- **Função** (ou Funcao, funcao)
- **Unidade**
- **Tipo** (ou Tipo Acidente, tipo_acidente)
- **Gravidade**
- **Descrição** (ou Descricao, descricao)
- **Causa**
- **Medidas Corretivas** (ou Medidas, medidas_corretivas)
- **CAT** (opcional: Sim/Não, true/false, 1/0)
- **Dias Afastamento** (opcional, número)
- **Data Retorno** (opcional, formato: DD/MM/YYYY ou YYYY-MM-DD)
- **Observações** (opcional)

### 🔧 Ordens de Serviço
Colunas esperadas:
- **Número OS** (ou Numero OS, numero, Número)
- **Data Abertura** (formato: DD/MM/YYYY ou YYYY-MM-DD)
- **Data Fechamento** (opcional, formato: DD/MM/YYYY ou YYYY-MM-DD)
- **Unidade**
- **Regional**
- **Tipo de Serviço** (ou Tipo Servico, tipo_servico)
- **Descrição** (ou Descricao, descricao)
- **Solicitante**
- **Status**
- **Prioridade**
- **Responsável** (opcional, ou Responsavel, responsavel)
- **Valor Estimado** (opcional, número)
- **Valor Realizado** (opcional, número)
- **Observações** (opcional)

## Dicas Importantes

1. **Primeira linha = Cabeçalho**: A primeira linha do arquivo deve conter os nomes das colunas
2. **Flexibilidade de nomes**: O sistema reconhece variações de nomes (maiúsculas/minúsculas, com/sem acentos)
3. **Datas**: Aceita formatos DD/MM/YYYY ou YYYY-MM-DD
4. **CPFs**: Aceita com ou sem formatação (000.000.000-00 ou 00000000000)
5. **Importação Incremental**: Dados existentes podem ser atualizados em importações futuras

## Onde os Dados Ficam

Os dados são salvos em tabelas staging no Neon:
- `stg_spci` - Dados de extintores
- `stg_cipa` - Dados da CIPA
- `stg_acidentes` - Dados de acidentes
- `stg_ordens_servico` - Dados de ordens de serviço

## Próximos Passos

Após importar as bases:
1. Os dados estarão disponíveis para consulta
2. As páginas correspondentes poderão ser desenvolvidas
3. Os relatórios já estão preparados para incluir essas abas quando os dados estiverem disponíveis

## Suporte

Se tiver dúvidas sobre a estrutura ou encontrar erros na importação, me avise que ajusto!
