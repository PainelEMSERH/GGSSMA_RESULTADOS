
// Normaliza o nome da função (remove acentos, (A), espaços extras)
export function normalizeFunction(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .toUpperCase()
    .replace(/\(A\)/g, '') // Remove (A)
    .replace(/\s+/g, ' ') // Remove espaços duplicados
    .trim();
}

// Mapeamento manual de De (Alterdata) -> Para (Neon)
// Chaves devem estar normalizadas (UPPERCASE, SEM ACENTO, SEM (A))
const MANUAL_ALIASES: Record<string, string> = {
  'JOVEM APRENDIZ': 'APRENDIZ - ASSISTENTE ADMINISTRATIVO',
  'MENOR APRENDIZ - ASSISTENTE ADMINISTRATIVO': 'APRENDIZ - ASSISTENTE ADMINISTRATIVO',
  'ANALISTA AMBIENTAL': 'ANALISTA DE MEIO AMBIENTE',
  'ADMINISTRADOR HOSPITALAR': 'COORDENADOR DE GESTAO HOSPITALAR',
};

export function findBestFunctionMatch(target: string, dbFunctions: string[]): string | null {
  if (!target) return null;
  const targetNorm = normalizeFunction(target);
  
  // 1. Tenta encontrar correspondência exata na lista do banco (normalizada)
  const exactMatch = dbFunctions.find(f => normalizeFunction(f) === targetNorm);
  if (exactMatch) return exactMatch;

  // 2. Tenta via Alias Manual
  if (MANUAL_ALIASES[targetNorm]) {
    const aliasTarget = MANUAL_ALIASES[targetNorm];
    // Verifica se o alias existe no banco (pode ser parcial)
    const aliasMatch = dbFunctions.find(f => normalizeFunction(f) === normalizeFunction(aliasTarget));
    if (aliasMatch) return aliasMatch;
    // Se não achar exato, retorna o alias mesmo assim (para tentar match parcial depois)
    return aliasTarget;
  }

  // 3. Regra Especial: MOTORISTA
  // Se começa com MOTORISTA e não achou exato (ex: MOTORISTA DE CARRETA), tenta "MOTORISTA" genérico
  if (targetNorm.startsWith('MOTORISTA')) {
    const motoristaGenerico = dbFunctions.find(f => normalizeFunction(f) === 'MOTORISTA');
    if (motoristaGenerico) return motoristaGenerico;
  }

  return null; // Não achou correspondência
}
