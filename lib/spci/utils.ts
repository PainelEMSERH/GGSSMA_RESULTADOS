/**
 * Utilitários para cálculo de status e datas do SPCI
 * REGRA CRÍTICA: Status e Data Limite são sempre calculados, nunca salvos no banco
 */

export type StatusExtintor = 'OK' | 'A VENCER' | 'VENCIDO';

export interface CalculoStatus {
  status: StatusExtintor;
  dataLimite: Date | null;
  diasRestantes: number | null;
}

/**
 * Converte data no formato dd/mm/yyyy para Date
 */
export function parseDateBR(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed === 'NULL' || trimmed === 'null') return null;
  
  // Formato dd/mm/yyyy
  const parts = trimmed.split('/');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
  const year = parseInt(parts[2], 10);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  
  return date;
}

/**
 * Formata Date para dd/mm/yyyy
 */
export function formatDateBR(date: Date | null | undefined): string {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Calcula o mês em português a partir de uma data
 */
export function getMesBR(date: Date | null | undefined): string {
  if (!date) return '';
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  return meses[date.getMonth()] || '';
}

/**
 * Calcula status e data limite com base na última recarga
 * @param ultimaRecarga Data da última recarga (formato dd/mm/yyyy ou Date)
 * @param periodoMeses Período legal em meses (padrão: 12)
 * @returns Status calculado e data limite
 */
export function calcularStatus(
  ultimaRecarga: string | Date | null | undefined,
  periodoMeses: number = 12
): CalculoStatus {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  // Parse da data de última recarga
  let dataUltimaRecarga: Date | null = null;
  if (ultimaRecarga instanceof Date) {
    dataUltimaRecarga = ultimaRecarga;
  } else if (typeof ultimaRecarga === 'string') {
    dataUltimaRecarga = parseDateBR(ultimaRecarga);
  }
  
  if (!dataUltimaRecarga) {
    return {
      status: 'VENCIDO',
      dataLimite: null,
      diasRestantes: null,
    };
  }
  
  // Calcula data limite: última recarga + período
  const dataLimite = new Date(dataUltimaRecarga);
  dataLimite.setMonth(dataLimite.getMonth() + periodoMeses);
  dataLimite.setHours(23, 59, 59, 999);
  
  // Calcula dias restantes
  const diffMs = dataLimite.getTime() - hoje.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  // Determina status
  let status: StatusExtintor;
  if (diasRestantes < 0) {
    status = 'VENCIDO';
  } else if (diasRestantes <= 30) {
    status = 'A VENCER';
  } else {
    status = 'OK';
  }
  
  return {
    status,
    dataLimite,
    diasRestantes,
  };
}

/**
 * Converte "Possui Contrato" para boolean
 */
export function parsePossuiContrato(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  return normalized === 'SIM' || normalized === 'S' || normalized === 'TRUE' || normalized === '1';
}

/**
 * Converte boolean para "Possui Contrato"
 */
export function formatPossuiContrato(value: boolean): string {
  return value ? 'SIM' : 'NÃO';
}
