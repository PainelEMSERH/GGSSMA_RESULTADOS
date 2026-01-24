
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
    .replace(/\b(SVO|S\.V\.O)\b/g, 'SERVICO DE VERIFICACAO DE OBITOS') // Padroniza SVO
    .replace(/\b(HEMONUCLEO|HEMONÚCLEO)\b/g, 'HEMONUCLEO') // Padroniza HEMONÚCLEO
    .replace(/\b(HEMOMAR)\b/g, 'HEMOMAR') // Mantém HEMOMAR
    .replace(/\b(UPA)\b/g, 'UPA') // Mantém UPA
    .trim();
}

// Mapeamento manual para casos extremos onde a normalização não basta
// Formato: Alterdata (Chave) -> EPI Map (Valor)
const MANUAL_MAPPING: Record<string, string> = {
  // Mapeamentos existentes
  'HOSPITAL E MATERNIDADE ADERSON MARINHO - P. FRANCO': 'PORTO FRANCO',
  'HOSPITAL E MATERNIDADE ADERSON MARINHO-P. FRANCO': 'PORTO FRANCO',
  'HOSPITAL MACRORREGIONAL DRA RUTH NOLETO': 'RUTH NOLETO',
  
  // SVO / Serviço de Verificação de Óbitos
  'SVO -SERV.VERIFICACAO DE OBITOS-IMPERATRIZ': 'SERVIÇO DE VERIFICAÇÃO DE ÓBITOS - IMPERATRIZ',
  'SVO -SERV. VERIFICAÇÃO DE ÓBITOS - IMPERATRIZ': 'SERVIÇO DE VERIFICAÇÃO DE ÓBITOS - IMPERATRIZ',
  'SVO -SERV. VERIFICAÇÃO DE ÓBITOS - SÃO LUÍS': 'SVO - SÃO LUÍS',
  'SERVICO DE VERIFICACAO DE OBITOS IMPERATRIZ': 'SERVIÇO DE VERIFICAÇÃO DE ÓBITOS - IMPERATRIZ',
  
  // Hospitais Regionais
  'HOSPITAL REGIONAL DE TIMBIRAS': 'HOSPITAL REGIONAL TIMBIRAS',
  'HOSPITAL GERAL DE ALTO ALEGRE': 'HOSPITAL REGIONAL DE ALTO ALEGRE DO MARANHÃO',
  'HOSPITAL MATERNO INFANTIL IMPERATRIZ': 'HOSPITAL MATERNO INFANTIL DE IMPERATRIZ',
  'HOSPITAL PRESIDENTE DUTRA': 'HOSPITAL MACRORREGIONAL DE PRESIDENTE DUTRA',
  'HOSPITAL MACROREGIONAL DE CAXIAS': 'HOSPITAL MACRORREGIONAL DE CAXIAS',
  'HOSPITAL ADELIA MATOS FONSECA': 'HOSPITAL REGIONAL ADÉLIA MATOS FONSECA',
  'HOSPITAL GERAL DE PERITORO': 'HOSPITAL REGIONAL DE PERITORÓ',
  'HOSPITAL REGIONAL SANTA LUZIA DO PARUA': 'HOSPITAL REGIONAL DE SANTA LUZIA DO PARUÁ',
  'HOSPITAL REGIONAL DE BARRA DO CORDA': 'HOSPITAL REGIONAL DE BARRA DO CORDA',
  
  // Hemonúcleos
  'HEMONUCLEO PINHEIRO': 'HEMONÚCLEO - PINHEIROS',
  'HEMONUCLEO SANTA INES': 'HEMONÚCLEO - SANTA INÊS',
  'HEMONUCLEO DE BACABAL': 'HEMONÚCLEO BACABAL',
  'HEMONUCLEO DE BALSAS': 'HEMONÚCLEO - BALSAS',
  'HEMONUCLEO DE CODO': 'HEMONÚCLEO - CODÓ',
  'HEMONUCLEO DE CAXIAS': 'HEMONÚCLEO - CAXIAS',
  'HEMONUCLEO DE IMPERATRIZ': 'HEMONÚCLEO - IMPERATRIZ',
  'HEMONUCLEO DE PEDREIRAS': 'HEMONÚCLEO PEDREIRAS',
  
  // UPAs
  'UPA SAO JOAO DOS PATOS': 'UPA - SÃO JOÃO DOS PATOS',
  
  // Outros
  'HOSPITAL DA ILHA': 'HOSPITAL DA ILHA',
  'HOSPITAL PRESIDENTE VARGAS': 'HOSPITAL PRESIDENTE VARGAS',
  'LACEN': 'LACEN',
  'HEMOMAR': 'HEMOMAR',
  'CENTRAL DE ABASTECIMENTO HOSPITALAR - CAHOSP': 'CENTRAL DE ABASTECIMENTO HOSPITALAR - CAHOSP',
};

// Encontra a melhor correspondência na lista do banco
export function findBestUnitMatch(targetUnit: string, dbUnits: string[]): string | null {
  if (!targetUnit) return null;

  const targetNorm = normalizeUnitName(targetUnit);
  
  // 1. Tenta encontrar via mapeamento manual (busca exata primeiro)
  const exactMapping = MANUAL_MAPPING[targetUnit];
  if (exactMapping) {
    const match = dbUnits.find(u => {
      const uNorm = normalizeUnitName(u);
      const mappingNorm = normalizeUnitName(exactMapping);
      return uNorm === mappingNorm || uNorm.includes(mappingNorm) || mappingNorm.includes(uNorm);
    });
    if (match) return match;
  }
  
  // 2. Tenta encontrar via mapeamento manual (busca normalizada)
  for (const [key, value] of Object.entries(MANUAL_MAPPING)) {
    const keyNorm = normalizeUnitName(key);
    if (keyNorm === targetNorm || targetNorm.includes(keyNorm) || keyNorm.includes(targetNorm)) {
      // Procura na lista do banco algo que contenha o valor mapeado
      const valueNorm = normalizeUnitName(value);
      const match = dbUnits.find(u => {
        const uNorm = normalizeUnitName(u);
        return uNorm === valueNorm || uNorm.includes(valueNorm) || valueNorm.includes(uNorm);
      });
      if (match) return match;
    }
  }

  // 3. Tenta encontrar correspondência exata normalizada
  const exactMatch = dbUnits.find(u => normalizeUnitName(u) === targetNorm);
  if (exactMatch) return exactMatch;

  // 4. Tenta encontrar contida (target contido no DB ou DB contido no target)
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
