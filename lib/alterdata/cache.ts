/**
 * Sistema de Cache Global para Alterdata
 * 
 * Carrega dados UMA VEZ e mantém em cache durante toda a sessão.
 * Cache persiste entre navegações e só é descartado em refresh ou logout.
 */

type AlterdataCache = {
  batch_id: string | null;
  columns: string[];
  rows: Array<Record<string, any>>;
  unidKey: string | null;
  votePeek: string;
  timestamp: number;
};

const CACHE_KEY = 'alterdata_global_cache_v1';
const SESSION_KEY = 'alterdata_session_loaded';

/**
 * Verifica se já foi carregado nesta sessão
 */
export function isSessionLoaded(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

/**
 * Marca como carregado nesta sessão
 */
export function markSessionLoaded(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY, 'true');
}

/**
 * Limpa o cache da sessão (usado em logout ou refresh manual)
 */
export function clearSessionCache(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Obtém cache do localStorage
 */
export function getCache(): AlterdataCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as AlterdataCache;
    // Valida estrutura
    if (
      parsed &&
      Array.isArray(parsed.columns) &&
      Array.isArray(parsed.rows) &&
      parsed.rows.length > 0
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Salva cache no localStorage
 */
export function setCache(cache: AlterdataCache): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    markSessionLoaded();
  } catch (e) {
    console.error('Erro ao salvar cache:', e);
  }
}

/**
 * Limpa cache completamente
 */
export function clearCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error('Erro ao limpar cache:', e);
  }
}

/**
 * Verifica se o cache é válido para o batch_id atual
 */
export function isCacheValid(batchId: string | null): boolean {
  const cache = getCache();
  if (!cache) return false;
  // Cache é válido se batch_id for o mesmo
  return cache.batch_id === batchId;
}
