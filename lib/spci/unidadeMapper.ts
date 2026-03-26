/**
 * Mapeamento de nomes de unidades SPCI para nomes mais legíveis
 * Organiza por tipo e padroniza os nomes
 */

export interface UnidadeInfo {
  nomeOriginal: string;
  nomeFormatado: string;
  tipo: 'AGENCIA' | 'HOSPITAL' | 'POLICLINICA' | 'UPA' | 'HEMONUCLEO' | 'FEME' | 'LACEN' | 'SVO' | 'TEA' | 'CER' | 'CAF' | 'APO' | 'OUTROS';
  categoria: string;
}

// Mapeamento direto de nomes originais para nomes formatados
const MAPEAMENTO_UNIDADES: Record<string, Omit<UnidadeInfo, 'nomeOriginal'>> = {
  'INT-AGTR-BARRA DO CORDA': { nomeFormatado: 'Agência Transfusional de Barra do Corda', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-COLINAS': { nomeFormatado: 'Agência Transfusional de Colinas', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-DE SÃO JOÃO DOS PATOS': { nomeFormatado: 'Agência Transfusional de São João dos Patos', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-VIANA': { nomeFormatado: 'Agência Transfusional de Viana', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-AÇAILÂNDIA': { nomeFormatado: 'Agência Transfusional de Açailândia', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-ALTO PARNAÍBA': { nomeFormatado: 'Agência Transfusional de Alto Parnaíba', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-CAROLINA': { nomeFormatado: 'Agência Transfusional de Carolina', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-COELHO NETO': { nomeFormatado: 'Agência Transfusional de Coelho Neto', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-COROATÁ': { nomeFormatado: 'Agência Transfusional de Coroatá', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-CURURUPU': { nomeFormatado: 'Agência Transfusional de Cururupu', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-PORTO FRANCO': { nomeFormatado: 'Agência Transfusional de Porto Franco', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-PRESIDENTE DUTRA': { nomeFormatado: 'Agência Transfusional de Presidente Dutra', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-SANTA LUZIA': { nomeFormatado: 'Agência Transfusional de Santa Luzia', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },
  'INT-AGTR-ZÉ DOCA': { nomeFormatado: 'Agência Transfusional de Zé Doca', tipo: 'AGENCIA', categoria: 'Agências Transfusionais' },

  'INT-HOSP-BARREIRINHAS': { nomeFormatado: 'Hospital de Barreirinhas', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-MORROS': { nomeFormatado: 'Hospital Regional de Morros', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-PAULINO NEVES': { nomeFormatado: 'Hospital de Paulino Neves', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-ITAPECURU MIRIM': { nomeFormatado: 'Hospital Adélia Matos Fonseca', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-CARUTAPERA': { nomeFormatado: 'Hospital Regional de Carutapera', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-STA LUZIA PARUÁ': { nomeFormatado: 'Hospital Regional Santa Luzia do Paruá', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-PRESID DUTRA': { nomeFormatado: 'Hospital Presidente Dutra', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-ALTO ALEGRE': { nomeFormatado: 'Hospital Geral de Alto Alegre', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-CAXIAS': { nomeFormatado: 'Hospital Macrorregional de Caxias', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-LAGO DA PEDRA': { nomeFormatado: 'Hospital Regional de Lago da Pedra', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-PEDREIRAS': { nomeFormatado: 'Hospital de Pedreiras', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-CHAPADINHA': { nomeFormatado: 'Hospital Regional de Chapadinha', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-COROATÁ': { nomeFormatado: 'Hospital Macrorregional de Coroatá', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-PERITORÓ': { nomeFormatado: 'Hospital Geral de Peritoró', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-TIMBIRAS': { nomeFormatado: 'Hospital Regional de Timbiras', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-TIMON': { nomeFormatado: 'Hospital Regional Alarico Nunes Pacheco', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-GRAJAÚ': { nomeFormatado: 'Hospital Geral de Grajaú', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-BARRA DO CORDA': { nomeFormatado: 'Hospital Regional de Barra do Corda', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-IMPERATRIZ MT': { nomeFormatado: 'Hospital Materno Infantil Imperatriz', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'INT-HOSP-IMPERATRIZ RN': { nomeFormatado: 'Hospital Macrorregional Dra. Ruth Noleto', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'SLZ-HOSP-AQUILES LISBOA': { nomeFormatado: 'Hospital Aquiles Lisboa', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'SLZ-HOSP-HOSP DA ILHA': { nomeFormatado: 'Hospital da Ilha', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'SLZ-HOSP-HCI': { nomeFormatado: 'Hospital de Cuidados Intensivos - HCI', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'SLZ-HOSP-DR. GENÉSIO RÊGO': { nomeFormatado: 'Hospital Genésio Rêgo', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'SLZ-HOSP-PRESID VARGAS': { nomeFormatado: 'Hospital Presidente Vargas', tipo: 'HOSPITAL', categoria: 'Hospitais' },
  'SLZ-HOSP-VILA LUIZÃO': { nomeFormatado: 'Hospital Vila Luizão', tipo: 'HOSPITAL', categoria: 'Hospitais' },

  'INT-POLI-MATÕES DO NORTE': { nomeFormatado: 'Policlínica de Matões do Norte', tipo: 'POLICLINICA', categoria: 'Policlínicas' },
  'INT-POLI-CAXIAS': { nomeFormatado: 'Policlínica de Caxias', tipo: 'POLICLINICA', categoria: 'Policlínicas' },
  'INT-POLI-CODÓ': { nomeFormatado: 'Policlínica de Codó', tipo: 'POLICLINICA', categoria: 'Policlínicas' },
  'INT-POLI-IMPERATRIZ': { nomeFormatado: 'Policlínica de Imperatriz', tipo: 'POLICLINICA', categoria: 'Policlínicas' },
  'INT-POLI-AÇAILÂNDIA': { nomeFormatado: 'Policlínica de Açailândia', tipo: 'POLICLINICA', categoria: 'Policlínicas' },
  'INT-POLI-BARRA DO CORDA': { nomeFormatado: 'Policlínica de Barra do Corda', tipo: 'POLICLINICA', categoria: 'Policlínicas' },
  'SLZ-POLI-CIDADE OPERÁRIA': { nomeFormatado: 'Policlínica Cidade Operária', tipo: 'POLICLINICA', categoria: 'Policlínicas' },
  'SLZ-POLI-COHATRAC': { nomeFormatado: 'Policlínica Cohatrac', tipo: 'POLICLINICA', categoria: 'Policlínicas' },
  'SLZ-POLI-COROADINHO': { nomeFormatado: 'Policlínica do Coroadinho', tipo: 'POLICLINICA', categoria: 'Policlínicas' },

  'INT-UPA-SÃO JOÃO PATOS': { nomeFormatado: 'UPA São João dos Patos', tipo: 'UPA', categoria: 'UPAs' },
  'INT-UPA-CODÓ': { nomeFormatado: 'UPA de Codó', tipo: 'UPA', categoria: 'UPAs' },
  'INT-UPA-COROATA': { nomeFormatado: 'UPA de Coroatá', tipo: 'UPA', categoria: 'UPAs' },
  'INT-UPA-TIMON': { nomeFormatado: 'UPA de Timon', tipo: 'UPA', categoria: 'UPAs' },
  'INT-UPA-IMPERATRIZ': { nomeFormatado: 'UPA de Imperatriz', tipo: 'UPA', categoria: 'UPAs' },
  'SLZ-UPA-ARAÇAGY': { nomeFormatado: 'UPA Aracagy', tipo: 'UPA', categoria: 'UPAs' },
  'SLZ-UPA-ITAQUI BACANGA': { nomeFormatado: 'UPA Itaqui Bacanga', tipo: 'UPA', categoria: 'UPAs' },
  'SLZ-UPA-PARQUE VITÓRIA': { nomeFormatado: 'UPA Parque Vitória', tipo: 'UPA', categoria: 'UPAs' },
  'SLZ-UPA-PAÇO DO LUMIAR': { nomeFormatado: 'UPA Paço do Lumiar', tipo: 'UPA', categoria: 'UPAs' },
  'SLZ-UPA-VINHAIS': { nomeFormatado: 'UPA Vinhais', tipo: 'UPA', categoria: 'UPAs' },

  'INT-HEMO-BACABAL': { nomeFormatado: 'Hemonúcleo de Bacabal', tipo: 'HEMONUCLEO', categoria: 'Hemonúcleos' },
  'INT-HEMO-BALSAS': { nomeFormatado: 'Hemonúcleo de Balsas', tipo: 'HEMONUCLEO', categoria: 'Hemonúcleos' },
  'INT-HEMO-CAXIAS': { nomeFormatado: 'Hemonúcleo de Caxias', tipo: 'HEMONUCLEO', categoria: 'Hemonúcleos' },
  'INT-HEMO-CODÓ': { nomeFormatado: 'Hemonúcleo de Codó', tipo: 'HEMONUCLEO', categoria: 'Hemonúcleos' },
  'INT-HEMO-IMPERATRIZ': { nomeFormatado: 'Hemonúcleo de Imperatriz', tipo: 'HEMONUCLEO', categoria: 'Hemonúcleos' },
  'INT-HEMO-PEDREIRAS': { nomeFormatado: 'Hemonúcleo de Pedreiras', tipo: 'HEMONUCLEO', categoria: 'Hemonúcleos' },
  'INT-HEMO-SANTA INÊS': { nomeFormatado: 'Hemonúcleo de Santa Inês', tipo: 'HEMONUCLEO', categoria: 'Hemonúcleos' },
  'SLZ-HEMO-HEMOMAR': { nomeFormatado: 'Hemomar', tipo: 'HEMONUCLEO', categoria: 'Hemonúcleos' },

  'CAF-FEME': { nomeFormatado: 'CAF - FEME', tipo: 'FEME', categoria: 'FEME' },
  'FEME SÃO LUIS': { nomeFormatado: 'FEME São Luís', tipo: 'FEME', categoria: 'FEME' },
  'INT-FEME-CAXIAS': { nomeFormatado: 'FEME de Caxias', tipo: 'FEME', categoria: 'FEME' },
  'INT-FEME-IMPERATRIZ': { nomeFormatado: 'FEME de Imperatriz', tipo: 'FEME', categoria: 'FEME' },

  'SLZ-LACEN': { nomeFormatado: 'LACEN', tipo: 'LACEN', categoria: 'LACEN' },
  'INT-LACEN-IMPERATRIZ': { nomeFormatado: 'LACEN de Imperatriz', tipo: 'LACEN', categoria: 'LACEN' },

  'SLZ-SVO-IML UFMA': { nomeFormatado: 'SVO - Serv. Verificação de Óbitos - São Luís', tipo: 'SVO', categoria: 'SVO' },
  'IMP-SVO-IML': { nomeFormatado: 'SVO - Serv. Verificação de Óbitos - Imperatriz', tipo: 'SVO', categoria: 'SVO' },

  'SLZ-TEA-OLHO D\'ÁGUA': { nomeFormatado: 'TEA - Centro Especializado de Reabilitação Olho D\'água', tipo: 'TEA', categoria: 'TEA' },
  'SLZ-TEA-COHAB': { nomeFormatado: 'Casa TEA 12+', tipo: 'TEA', categoria: 'TEA' },

  'CER - CIDADE OPERÁRIA': { nomeFormatado: 'Centro Especializado de Reabilitação Cidade Operária', tipo: 'CER', categoria: 'Centros de Reabilitação' },
  'CER - OLHO D\'ÁGUA': { nomeFormatado: 'Centro Especializado de Reabilitação Olho D\'água', tipo: 'CER', categoria: 'Centros de Reabilitação' },

  'INT-APO-IMPERATRIZ-CD GESTANTE': { nomeFormatado: 'Casa da Gestante, Bebê e Puérpera', tipo: 'APO', categoria: 'Apoio' },
  'INT-APO-IMPERATRIZ-CD PESS.IDOSA': { nomeFormatado: 'Centro da Pessoa Idosa', tipo: 'APO', categoria: 'Apoio' },
  'SLZ-APO-SOLAR DO OUTONO': { nomeFormatado: 'Solar do Outono', tipo: 'APO', categoria: 'Apoio' },

  'SLZ-CAHOSP': { nomeFormatado: 'CAHOSP EMSERH', tipo: 'OUTROS', categoria: 'Outros' },
  'SLZ-CDH-HEMODIÁLISE NR': { nomeFormatado: 'Clínica de Hemodiálise São Luís', tipo: 'OUTROS', categoria: 'Outros' },
  'SLZ-PAM DIAMANTE': { nomeFormatado: 'Centro de Especialidades Médicas PAM Diamante', tipo: 'OUTROS', categoria: 'Outros' },
  'SHOPPING DA CRIANÇA': { nomeFormatado: 'Shopping da Criança', tipo: 'OUTROS', categoria: 'Outros' },
  'SLZ-SEDE-ADM': { nomeFormatado: 'Sede Administrativa EMSERH', tipo: 'OUTROS', categoria: 'Outros' },
  'SLZ-SEDE-ANEXO1': { nomeFormatado: 'Sede Anexo 01 EMSERH', tipo: 'OUTROS', categoria: 'Outros' },
  'SLZ-SEDE-ANEXO2': { nomeFormatado: 'Sede Anexo 02 EMSERH', tipo: 'OUTROS', categoria: 'Outros' },
};

/**
 * Formata o nome da unidade para exibição
 */
export function formatarNomeUnidade(nomeOriginal: string): string {
  const mapeado = MAPEAMENTO_UNIDADES[nomeOriginal];
  return mapeado?.nomeFormatado || nomeOriginal;
}

/**
 * Obtém informações completas da unidade
 */
export function getUnidadeInfo(nomeOriginal: string): UnidadeInfo {
  const mapeado = MAPEAMENTO_UNIDADES[nomeOriginal];
  if (mapeado) {
    return {
      nomeOriginal,
      ...mapeado,
    };
  }
  return {
    nomeOriginal,
    nomeFormatado: nomeOriginal,
    tipo: 'OUTROS',
    categoria: 'Outros',
  };
}

/**
 * Obtém todas as categorias únicas
 */
export function getCategorias(): string[] {
  const categorias = new Set<string>();
  Object.values(MAPEAMENTO_UNIDADES).forEach((info) => {
    categorias.add(info.categoria);
  });
  return Array.from(categorias).sort();
}
