
// Normaliza o nome da unidade para comparação (remove acentos, espaços extras, conectivos e pontuação)
function normalizeUnitName(name: string): string {
  if (!name) return '';
  
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ') // Substitui caracteres especiais por espaço
    .replace(/\b(DE|DA|DO|DAS|DOS|E|EM|NO|NA)\b/g, ' ') // Remove conectivos
    .replace(/\s+/g, ' ') // Remove espaços duplicados
    .replace(/^(HOSPITAL|HOSP|HOSP\.)\b/, 'HOSPITAL') // Padroniza HOSPITAL
    .replace(/\b(DRA|DRA\.)\b/, 'DOUTORA') // Padroniza DRA -> DOUTORA
    .replace(/\b(DR|DR\.)\b/, 'DOUTOR') // Padroniza DR -> DOUTOR
    .replace(/\b(SVO|S\.V\.O)\b/, 'SERVICO DE VERIFICACAO DE OBITOS') // Padroniza SVO
    .trim();
}

// Mapeamento manual para casos extremos onde a normalização não basta
const MANUAL_MAPPING: Record<string, string> = {
  // Alterdata (Chave) -> EPI Map (Valor parcial ou exato para busca)
  'HOSPITAL E MATERNIDADE ADERSON MARINHO - P. FRANCO': 'PORTO FRANCO',
  'HOSPITAL E MATERNIDADE ADERSON MARINHO-P. FRANCO': 'PORTO FRANCO',
  'HOSPITAL MACRORREGIONAL DRA RUTH NOLETO': 'RUTH NOLETO',
  'SVO -SERV.VERIFICACAO DE OBITOS-IMPERATRIZ': 'VERIFICACAO DE OBITOS IMPERATRIZ',
};

// Encontra a melhor correspondência na lista do banco
export function findBestUnitMatch(targetUnit: string, dbUnits: string[]): string | null {
  if (!targetUnit) return null;

  const targetNorm = normalizeUnitName(targetUnit);
  
  // 1. Tenta encontrar via mapeamento manual
  for (const [key, value] of Object.entries(MANUAL_MAPPING)) {
    if (normalizeUnitName(key) === targetNorm || targetNorm.includes(normalizeUnitName(value))) {
      // Procura na lista do banco algo que contenha o valor mapeado
      const match = dbUnits.find(u => normalizeUnitName(u).includes(normalizeUnitName(value)));
      if (match) return match;
    }
  }

  // 2. Tenta encontrar correspondência exata normalizada
  const exactMatch = dbUnits.find(u => normalizeUnitName(u) === targetNorm);
  if (exactMatch) return exactMatch;

  // 3. Tenta encontrar contida (target contido no DB ou DB contido no target)
  // Prioriza o nome mais longo para evitar falsos positivos (ex: "UPA" dar match em "UPA TIMON")
  const containsMatch = dbUnits
    .filter(u => {
      const dbNorm = normalizeUnitName(u);
      return dbNorm.includes(targetNorm) || targetNorm.includes(dbNorm);
    })
    .sort((a, b) => b.length - a.length)[0]; // Pega o maior nome que deu match

  if (containsMatch) return containsMatch;

  return null;
}
