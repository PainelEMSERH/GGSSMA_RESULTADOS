// Mapeamento de nomes de colunas para exibição elegante e profissional

export const COLUMN_NAME_MAP: Record<string, string> = {
  // Identificação
  'CPF': 'CPF',
  'cpf': 'CPF',
  'Nrcpf': 'CPF',
  'nrcpf': 'CPF',
  'Nr CPF': 'CPF',
  'nr cpf': 'CPF',
  'Matrícula': 'MATRÍCULA',
  'matricula': 'MATRÍCULA',
  'Colaborador': 'COLABORADOR',
  'colaborador': 'COLABORADOR',
  'Nmfuncionario': 'COLABORADOR',
  'nmfuncionario': 'COLABORADOR',
  'Nm Funcionario': 'COLABORADOR',
  'nm funcionario': 'COLABORADOR',
  'Nome': 'Nome',
  'nome': 'Nome',
  
  // Unidade e Regional
  'Unidade Hospitalar': 'Unidade',
  'unidade_hospitalar': 'Unidade',
  'Unidade': 'Unidade',
  'unidade': 'Unidade',
  'Regional': 'Regional',
  'regional': 'Regional',
  'Nmdepartamento': 'Departamento',
  'nmdepartamento': 'Departamento',
  'Nm Departamento': 'Departamento',
  'nm departamento': 'Departamento',
  'Departamento': 'Departamento',
  'departamento': 'Departamento',
  'Cdchamada': 'MATRÍCULA',
  'cdchamada': 'MATRÍCULA',
  'Cd Chamada': 'MATRÍCULA',
  'cd chamada': 'MATRÍCULA',
  'Chamada': 'MATRÍCULA',
  'chamada': 'MATRÍCULA',
  
  // Função e Cargo
  'Função': 'FUNÇÃO',
  'funcao': 'FUNÇÃO',
  'Nmfuncao': 'FUNÇÃO',
  'nmfuncao': 'FUNÇÃO',
  'Nm Funcao': 'FUNÇÃO',
  'nm funcao': 'FUNÇÃO',
  'Cargo': 'Cargo',
  'cargo': 'Cargo',
  
  // Datas importantes
  'Admissão': 'ADMISSÃO',
  'admissao': 'ADMISSÃO',
  'Dtadmissao': 'ADMISSÃO',
  'dtadmissao': 'ADMISSÃO',
  'Dt Admissao': 'ADMISSÃO',
  'dt admissao': 'ADMISSÃO',
  'Demissão': 'DEMISSÃO',
  'demissao': 'DEMISSÃO',
  'Dtdemissao': 'DEMISSÃO',
  'dtdemissao': 'DEMISSÃO',
  'Dt Demissao': 'DEMISSÃO',
  'dt demissao': 'DEMISSÃO',
  'Nascimento': 'Data de Nascimento',
  'nascimento': 'Data de Nascimento',
  
  // ASO e Saúde
  'Data ASO': 'Data do ASO',
  'data_aso': 'Data do ASO',
  'Último ASO': 'Último ASO',
  'ultimo_aso': 'Último ASO',
  'Mês Ultimo ASO': 'Mês do Último ASO',
  'mes_ultimo_aso': 'Mês do Último ASO',
  'Tipo de ASO': 'TIPO ATESTADO',
  'tipo_aso': 'TIPO ATESTADO',
  'Tipo ASO': 'TIPO ATESTADO',
  'Desc Atestado': 'TIPO ATESTADO',
  'desc atestado': 'TIPO ATESTADO',
  'DescAtestado': 'TIPO ATESTADO',
  'descatestado': 'TIPO ATESTADO',
  'Proximo Aso': 'PRÓXIMO ASO',
  'proximo aso': 'PRÓXIMO ASO',
  'ProximoAso': 'PRÓXIMO ASO',
  'proximoaso': 'PRÓXIMO ASO',
  'Status Aso': 'STATUS',
  'status aso': 'STATUS',
  'StatusAso': 'STATUS',
  'statusaso': 'STATUS',
  
  // Status e Situação
  'Status': 'STATUS',
  'status': 'STATUS',
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
