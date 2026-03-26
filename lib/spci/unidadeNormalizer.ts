/**
 * Normalização de nomes de unidades para o SPCI
 * Mapeia os nomes exatos do Neon para garantir correspondência
 */

// Lista de unidades do Neon (exatas como estão no banco)
export const UNIDADES_NEON = [
  'INT-HOSP-BARREIRINHAS',
  'INT-POLI-MATÕES DO NORTE',
  'INT-AGTR-SANTA LUZIA',
  'INT-HOSP-MORROS',
  'INT-HOSP-PAULINO NEVES',
  'INT-HOSP-ITAPECURU MIRIM',
  'INT-AGTR-CURURUPU',
  'INT-AGTR-VIANA',
  'INT-AGTR-ZÉ DOCA',
  'INT-HOSP-CARUTAPERA',
  'INT-HOSP-STA LUZIA PARUÁ',
  'INT-AGTR-COLINAS',
  'INT-AGTR-DE SÃO JOÃO DOS PATOS',
  'INT-AGTR-PRESIDENTE DUTRA',
  'INT-HOSP-PRESID DUTRA',
  'INT-UPA-SÃO JOÃO PATOS',
  'SLZ-CAHOSP',
  'SHOPPING DA CRIANÇA',
  'SLZ-SEDE-ANEXO2',
  'CER - OLHO D\'ÁGUA',
  'SLZ-CDH-HEMODIÁLISE NR',
  'SLZ-HOSP-HCI',
  'SLZ-HOSP-HOSP DA ILHA',
  'SLZ-HOSP-VILA LUIZÃO',
  'SLZ-LACEN',
  'SLZ-PAM DIAMANTE',
  'SLZ-POLI-CIDADE OPERÁRIA',
  'SLZ-SVO-IML UFMA',
  'SLZ-TEA-OLHO D\'ÁGUA',
  'SLZ-UPA-ARAÇAGY',
  'SLZ-UPA-ITAQUI BACANGA',
  'SLZ-UPA-PARQUE VITÓRIA',
  'CAF-FEME',
  'CER - CIDADE OPERÁRIA',
  'FEME SÃO LUIS',
  'SLZ-APO-SOLAR DO OUTONO',
  'SLZ-HEMO-HEMOMAR',
  'SLZ-HOSP-AQUILES LISBOA',
  'SLZ-HOSP-DR. GENÉSIO RÊGO',
  'SLZ-HOSP-PRESID VARGAS',
  'SLZ-POLI-COHATRAC',
  'SLZ-POLI-COROADINHO',
  'SLZ-SEDE-ADM',
  'SLZ-SEDE-ANEXO1',
  'SLZ-TEA-COHAB',
  'SLZ-UPA-PAÇO DO LUMIAR',
  'SLZ-UPA-VINHAIS',
  'INT-AGTR-COELHO NETO',
  'INT-AGTR-COROATÁ',
  'INT-FEME-CAXIAS',
  'INT-HEMO-BACABAL',
  'INT-HEMO-CAXIAS',
  'INT-HEMO-CODÓ',
  'INT-HOSP-ALTO ALEGRE',
  'INT-HOSP-CAXIAS',
  'INT-HOSP-LAGO DA PEDRA',
  'INT-HOSP-PEDREIRAS',
  'INT-HOSP-CHAPADINHA',
  'INT-HEMO-SANTA INÊS',
  'INT-HOSP-COROATÁ',
  'INT-HEMO-PEDREIRAS',
  'INT-HOSP-PERITORÓ',
  'INT-HOSP-TIMBIRAS',
  'INT-HOSP-TIMON',
  'INT-POLI-CAXIAS',
  'INT-POLI-CODÓ',
  'INT-UPA-CODÓ',
  'INT-UPA-COROATA',
  'INT-UPA-TIMON',
  'INT-AGTR-AÇAILÂNDIA',
  'INT-AGTR-BARRA DO CORDA',
  'INT-AGTR-ALTO PARNAÍBA',
  'INT-AGTR-CAROLINA',
  'INT-HOSP-GRAJAÚ',
  'INT-AGTR-PORTO FRANCO',
  'INT-APO-IMPERATRIZ-CD GESTANTE',
  'INT-APO-IMPERATRIZ-CD PESS.IDOSA',
  'INT-POLI-BARRA DO CORDA',
  'INT-HEMO-BALSAS',
  'INT-HEMO-IMPERATRIZ',
  'INT-HOSP-BARRA DO CORDA',
  'INT-HOSP-IMPERATRIZ MT',
  'INT-HOSP-IMPERATRIZ RN',
  'INT-FEME-IMPERATRIZ',
  'INT-LACEN-IMPERATRIZ',
  'INT-POLI-AÇAILÂNDIA',
  'INT-POLI-IMPERATRIZ',
  'IMP-SVO-IML',
  'INT-UPA-IMPERATRIZ',
] as const;

/**
 * Normaliza nome de unidade para comparação
 * Remove acentos, converte para maiúsculas, remove espaços extras
 */
export function normalizeUnidadeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' '); // Normaliza espaços
}

/**
 * Encontra a unidade exata do Neon que corresponde ao nome fornecido
 * Usa normalização para fazer match mesmo com diferenças de acentuação/case
 */
export function findUnidadeMatch(searchName: string | null | undefined): string | null {
  if (!searchName) return null;
  
  const normalized = normalizeUnidadeName(searchName);
  
  // 1. Tenta match exato normalizado
  for (const unidade of UNIDADES_NEON) {
    if (normalizeUnidadeName(unidade) === normalized) {
      return unidade;
    }
  }
  
  // 2. Tenta match parcial (contém)
  for (const unidade of UNIDADES_NEON) {
    const unidadeNorm = normalizeUnidadeName(unidade);
    if (unidadeNorm.includes(normalized) || normalized.includes(unidadeNorm)) {
      return unidade;
    }
  }
  
  return null;
}

/**
 * Retorna todas as unidades únicas do Neon
 */
export function getAllUnidades(): readonly string[] {
  return UNIDADES_NEON;
}
