// Mapeamento de nomes de colunas para exibição elegante e profissional

export const COLUMN_NAME_MAP: Record<string, string> = {
  // Identificação
  'CPF': 'CPF',
  'cpf': 'CPF',
  'Matrícula': 'Matrícula',
  'matricula': 'Matrícula',
  'Colaborador': 'Colaborador',
  'colaborador': 'Colaborador',
  'Nome': 'Nome',
  'nome': 'Nome',
  
  // Unidade e Regional
  'Unidade Hospitalar': 'Unidade',
  'unidade_hospitalar': 'Unidade',
  'Unidade': 'Unidade',
  'unidade': 'Unidade',
  'Regional': 'Regional',
  'regional': 'Regional',
  
  // Função e Cargo
  'Função': 'Função',
  'funcao': 'Função',
  'Cargo': 'Cargo',
  'cargo': 'Cargo',
  
  // Datas importantes
  'Admissão': 'Data de Admissão',
  'admissao': 'Data de Admissão',
  'Demissão': 'Data de Demissão',
  'demissao': 'Data de Demissão',
  'Nascimento': 'Data de Nascimento',
  'nascimento': 'Data de Nascimento',
  
  // ASO e Saúde
  'Data ASO': 'Data do ASO',
  'data_aso': 'Data do ASO',
  'Último ASO': 'Último ASO',
  'ultimo_aso': 'Último ASO',
  'Mês Ultimo ASO': 'Mês do Último ASO',
  'mes_ultimo_aso': 'Mês do Último ASO',
  'Tipo de ASO': 'Tipo de ASO',
  'tipo_aso': 'Tipo de ASO',
  'Tipo ASO': 'Tipo de ASO',
  
  // Status e Situação
  'Status': 'Status',
  'status': 'Status',
  'Situação': 'Situação',
  'situacao': 'Situação',
  'Situacao': 'Situação',
  
  // Contato (geralmente ocultas, mas mapeadas caso apareçam)
  'Telefone': 'Telefone',
  'telefone': 'Telefone',
  'Celular': 'Celular',
  'celular': 'Celular',
  'Email': 'E-mail',
  'email': 'E-mail',
  'E-mail': 'E-mail',
  
  // Localização
  'Cidade': 'Cidade',
  'cidade': 'Cidade',
  'Estado': 'Estado',
  'estado': 'Estado',
  'Endereço': 'Endereço',
  'endereco': 'Endereço',
  
  // Afastamentos
  'Início Afastamento': 'Início do Afastamento',
  'inicio_afastamento': 'Início do Afastamento',
  'Fim Afastamento': 'Fim do Afastamento',
  'fim_afastamento': 'Fim do Afastamento',
  'Motivo Afastamento': 'Motivo do Afastamento',
  'motivo_afastamento': 'Motivo do Afastamento',
  'Data Atestado': 'Data do Atestado',
  'data_atestado': 'Data do Atestado',
  
  // Outros
  'Periodicidade': 'Periodicidade',
  'periodicidade': 'Periodicidade',
  'Nome Médico': 'Nome do Médico',
  'nome_medico': 'Nome do Médico',
  'Estado Civil': 'Estado Civil',
  'estado_civil': 'Estado Civil',
  'Sexo': 'Sexo',
  'sexo': 'Sexo',
};

/**
 * Retorna o nome formatado e elegante de uma coluna
 */
export function getColumnDisplayName(columnName: string): string {
  if (!columnName) return '';
  
  // Verifica mapeamento direto
  if (COLUMN_NAME_MAP[columnName]) {
    return COLUMN_NAME_MAP[columnName];
  }
  
  // Normaliza e verifica novamente
  const normalized = columnName.trim();
  if (COLUMN_NAME_MAP[normalized]) {
    return COLUMN_NAME_MAP[normalized];
  }
  
  // Tenta encontrar por similaridade (case-insensitive)
  const lower = normalized.toLowerCase();
  for (const [key, value] of Object.entries(COLUMN_NAME_MAP)) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }
  
  // Se não encontrou, retorna o nome original com primeira letra maiúscula
  return normalized
    .split(/[\s_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
