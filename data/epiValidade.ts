// data/epiValidade.ts
// Define em quantos meses cada EPI deve ser entregue novamente (controle de qualidade).
// Usado para alertas de "próxima entrega" e "entregas vencidas". Não impacta meta.

/** Meses padrão quando o EPI não está na lista (ex.: 6 ou 12) */
export const VALIDADE_MESES_DEFAULT = 6;

/**
 * Mapa: nome do EPI (upper) -> quantidade de meses para próxima entrega.
 * Valores comuns: 6 (semestral), 12 (anual).
 */
const RAW_VALIDADE: Array<{ nome: string; meses: number }> = [
  { nome: 'Máscara N95', meses: 6 },
  { nome: 'Luva Nitrílica', meses: 6 },
  { nome: 'Luva nitrílica para proteção química e biológica', meses: 6 },
  { nome: 'Bota de PVC', meses: 12 },
  { nome: 'Bota PVC', meses: 12 },
  { nome: 'Avental de PVC', meses: 6 },
  { nome: 'Óculos de proteção', meses: 12 },
  { nome: 'Luva de Látex', meses: 6 },
  { nome: 'Luva Látex', meses: 6 },
  { nome: 'Cinto de Segurança', meses: 12 },
  { nome: 'Talabarte de Segurança', meses: 12 },
  { nome: 'Avental de chumbo ou plumbífero', meses: 12 },
  { nome: 'Óculos plumbíferos', meses: 12 },
  { nome: 'Protetores de gônadas', meses: 12 },
  { nome: 'Protetores de tireoide', meses: 12 },
  { nome: 'Máscara 6200', meses: 6 },
];

const MAPA = new Map<string, number>(
  RAW_VALIDADE.map((x) => [x.nome.toUpperCase().trim(), x.meses])
);

/**
 * Retorna quantos meses após a última entrega o colaborador deve receber novamente o EPI.
 * Usado para "próxima entrega em" e alertas de vencimento.
 */
export function getValidadeMeses(nome: string | null | undefined): number {
  if (!nome) return VALIDADE_MESES_DEFAULT;
  const key = String(nome).toUpperCase().trim();
  return MAPA.get(key) ?? VALIDADE_MESES_DEFAULT;
}
