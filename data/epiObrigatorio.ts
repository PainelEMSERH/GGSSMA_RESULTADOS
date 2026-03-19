
// data/epiObrigatorio.ts
// Define quais EPIs contam como OBRIGATÓRIOS para fins de meta/pendência/dashboard.
// A lista é baseada na definição do SESMT (Jonathan).

const RAW_OBRIGATORIOS = [
  'Máscara N95',
  'Luva Nitrílica', // Nomenclatura exata do banco
  'Luva nitrílica para proteção química e biológica', // Variação completa
  'Bota de PVC', // Nomenclatura exata do banco
  'Bota PVC', // Variação sem "de"
  'Avental de PVC',
  'Óculos de proteção',
  'Luva de Látex',
  'Luva Látex', // Variação sem "de"
  'Cinto de Segurança',
  'Talabarte de Segurança',
  'Avental de chumbo ou plumbífero',
  'Óculos plumbíferos',
  'Protetores de gônadas',
  'Protetores de tireoide',
  'Máscara 6200',
];

function norm(nome: string): string {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9 ]/g, ''); // remove pontuação (mantém espaço)
}

// Adiciona aliases comuns (planilhas costumam variar a nomenclatura)
const ALIASES = [
  'AVENTAL DE CHUMBO',
  'AVENTAL PLUMBIFERO',
  'AVENTAL PLUMBIFERO OU DE CHUMBO',
  'OCULOS PLUMBIFERO',
  'OCULOS PLUMBIFEROS',
  'PROTETOR DE GONADAS',
  'PROTETORES DE GONADAS',
  'PROTETOR DE TIREOIDE',
  'PROTETORES DE TIREOIDE',
];

const NORM_SET = new Set(
  [...RAW_OBRIGATORIOS, ...ALIASES].map((s) => norm(s)),
);

/**
 * Retorna true se o nome do EPI for considerado obrigatório
 * para fins de meta do SESMT.
 */
export function isEpiObrigatorio(nome: string | null | undefined): boolean {
  if (!nome) return false;
  return NORM_SET.has(norm(String(nome)));
}

/**
 * Gera um trecho de SQL para filtrar APENAS itens obrigatórios,
 * usando comparação case-insensitive. Requer que os nomes no
 * banco venham do mesmo mapa oficial de EPIs.
 *
 * Exemplo de uso:
 *   const whereObrig = obrigatoriosWhereSql('m.epi_item');
 *   const sql = `SELECT ... FROM ... WHERE ${whereObrig}`;
 */
export function obrigatoriosWhereSql(column: string): string {
  // Observação: aqui ainda é match exato em UPPER/TRIM (sem normalização de acento).
  // Para itens com acento/variação, a checagem principal deve ser feita via JS com isEpiObrigatorio.
  const list = Array.from(
    new Set(RAW_OBRIGATORIOS.map((s) => String(s).toUpperCase().trim())),
  )
    .map((v) => `'${v.replace(/'/g, "''")}'`)
    .join(', ');
  return `UPPER(TRIM(${column})) IN (${list})`;
}
