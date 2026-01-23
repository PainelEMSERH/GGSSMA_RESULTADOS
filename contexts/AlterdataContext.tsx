'use client';

/**
 * Context Global para Alterdata
 * 
 * Mantém os dados em cache durante toda a sessão.
 * Carrega UMA VEZ e reutiliza entre navegações.
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getCache, setCache, isSessionLoaded, markSessionLoaded, isCacheValid, clearCache } from '@/lib/alterdata/cache';

type AlterdataContextType = {
  columns: string[];
  rows: Array<Record<string, any>>;
  unidKey: string | null;
  votePeek: string;
  loading: boolean;
  error: string | null;
  progress: string;
  loadData: () => Promise<void>;
  clearData: () => void;
};

const AlterdataContext = createContext<AlterdataContextType | undefined>(undefined);

export function AlterdataProvider({ children }: { children: React.ReactNode }) {
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [unidKey, setUnidKey] = useState<string | null>(null);
  const [votePeek, setVotePeek] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  
  // Flag para garantir que só carrega UMA VEZ por sessão
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Carrega cache imediatamente no mount
  useEffect(() => {
    // Se já foi carregado nesta sessão, restaura do cache
    if (isSessionLoaded()) {
      const cache = getCache();
      if (cache) {
        setColumns(cache.columns);
        setRows(cache.rows);
        setUnidKey(cache.unidKey);
        setVotePeek(cache.votePeek);
        hasLoadedRef.current = true;
        return; // Já tem dados, não precisa carregar
      }
    }

    // Se tem cache válido mas não foi carregado nesta sessão, restaura
    const cache = getCache();
    if (cache && cache.rows.length > 0) {
      setColumns(cache.columns);
      setRows(cache.rows);
      setUnidKey(cache.unidKey);
      setVotePeek(cache.votePeek);
      markSessionLoaded();
      hasLoadedRef.current = true;
    }
  }, []);

  const loadData = async () => {
    // Se já carregou nesta sessão, não recarrega
    if (hasLoadedRef.current || isLoadingRef.current) {
      return;
    }

    // Se já tem dados, não recarrega
    if (rows.length > 0 && columns.length > 0) {
      hasLoadedRef.current = true;
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    setProgress('');

    try {
      // Busca batch_id atual
      const colsRes = await fetch('/api/alterdata/raw-columns', { cache: 'no-store' });
      const colsData = await colsRes.json();
      
      if (!colsData?.ok) {
        throw new Error(colsData?.error || 'Falha ao buscar colunas');
      }

      const batchId = colsData.batch_id || null;
      const baseCols = Array.isArray(colsData.columns) ? colsData.columns : [];

      // Verifica se cache é válido
      if (isCacheValid(batchId)) {
        const cache = getCache();
        if (cache) {
          setColumns(cache.columns);
          setRows(cache.rows);
          setUnidKey(cache.unidKey);
          setVotePeek(cache.votePeek);
          setLoading(false);
          markSessionLoaded();
          hasLoadedRef.current = true;
          isLoadingRef.current = false;
          return; // Usa cache, não precisa buscar do servidor
        }
      }

      // Se cache inválido, limpa
      if (!isCacheValid(batchId)) {
        clearCache();
      }

      // Carrega todas as páginas
      const firstPage = await fetch('/api/alterdata/raw-rows?page=1&limit=200', { cache: 'no-store' });
      const firstData = await firstPage.json();
      
      if (!firstData?.ok) {
        throw new Error(firstData?.error || 'Falha ao carregar dados');
      }

      const total = firstData.total || firstData.rows.length;
      const limit = firstData.limit || 200;
      const pages = Math.max(1, Math.ceil(total / limit));
      
      let allRows: Array<Record<string, any>> = firstData.rows.map((r: any) => ({
        row_no: r.row_no,
        ...r.data,
      }));

      setProgress(`${allRows.length}/${total}`);

      // Carrega páginas restantes
      for (let p = 2; p <= pages; p++) {
        const pageRes = await fetch(`/api/alterdata/raw-rows?page=${p}&limit=${limit}`, { cache: 'no-store' });
        const pageData = await pageRes.json();
        
        if (pageData?.ok && Array.isArray(pageData.rows)) {
          allRows = allRows.concat(
            pageData.rows.map((r: any) => ({
              row_no: r.row_no,
              ...r.data,
            }))
          );
          setProgress(`${Math.min(allRows.length, total)}/${total}`);
        }
      }

      // Importa funções de regionalização UMA VEZ
      const { UNID_TO_REGIONAL, canonUnidade } = await import('@/lib/unidReg');
      
      // Função auxiliar para normalizar
      function normCol(s: string) {
        return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
      }
      
      const NAME_HINTS = [
        'unidade','unid','nmdeunidade','nm_unidade','unidade_lotacao','lotacao','estabelecimento',
        'hospital','empresa','localtrabalho','localdetrabalho','setor','departamento'
      ];
      
      // Detecta coluna de unidade por votação
      function detectUnidadeKey(rows: Array<Record<string, any>>): { key: string|null, votes: Record<string, number> } {
        const votes: Record<string, number> = {};
        if (!rows?.length) return { key: null, votes };
        const keys = Object.keys(rows[0] || {});
        const top = rows.slice(0, Math.min(200, rows.length));
        for (const k of keys) {
          let v = 0;
          for (const r of top) {
            const raw = r?.[k];
            if (raw == null) continue;
            const s = String(raw);
            if (!s) continue;
            const canon = canonUnidade(s);
            if (canon && (UNID_TO_REGIONAL as any)[canon]) v++;
          }
          votes[k] = v;
        }
        const best = Object.entries(votes).sort((a,b)=>b[1]-a[1])[0];
        if (best && best[1] > 0) {
          return { key: best[0], votes };
        }
        // Fallback: busca por nome
        const scoreByName: Record<string, number> = {};
        for (const k of keys) {
          const n = normCol(k);
          let s = 0;
          for (const hint of NAME_HINTS) if (n.includes(hint)) s++;
          scoreByName[k] = s;
        }
        const bestName = Object.entries(scoreByName).sort((a,b)=>b[1]-a[1])[0];
        return { key: (bestName && bestName[1] > 0) ? bestName[0] : null, votes };
      }
      
      const det = detectUnidadeKey(allRows);
      const uk = det.key;

      // Mapeia regional
      const withReg = allRows.map((r: any) => {
        const rawUn = uk ? String(r[uk] ?? '') : '';
        const canon = canonUnidade(rawUn);
        const reg = (UNID_TO_REGIONAL as any)[canon] || '';
        return { ...r, regional: reg };
      });

      // Reordena colunas: Regional primeiro, Nmdepartamento segundo, Colaborador terceiro, Função quarto
      let finalCols = [...baseCols];
      finalCols = finalCols.filter(c => {
        const n = normCol(c);
        return n !== 'regional' 
          && !n.includes('nmdepartamento') && !n.includes('nm departamento')
          && !n.includes('nmfuncionario') && !n.includes('nm funcionario') && !n.includes('colaborador')
          && !n.includes('nmfuncao') && !n.includes('nm funcao') && !n.includes('funcao');
      });
      finalCols = ['regional', ...finalCols];
      
      // Adiciona Departamento em segundo
      const nmdepKey = baseCols.find(c => {
        const n = normCol(c);
        return n.includes('nmdepartamento') || n.includes('nm departamento') || n.includes('departamento');
      });
      if (nmdepKey) {
        const idx = finalCols.indexOf('regional');
        finalCols.splice(idx + 1, 0, nmdepKey);
      }
      
      // Adiciona Colaborador em terceiro
      const colaboradorKey = baseCols.find(c => {
        const n = normCol(c);
        return n.includes('nmfuncionario') || n.includes('nm funcionario') || n.includes('colaborador');
      });
      if (colaboradorKey) {
        const idx = finalCols.indexOf('regional');
        const deptIdx = nmdepKey ? finalCols.indexOf(nmdepKey) : idx;
        finalCols.splice(deptIdx + 1, 0, colaboradorKey);
      }
      
      // Adiciona Função ao lado de Colaborador (quarto)
      const funcaoKey = baseCols.find(c => {
        const n = normCol(c);
        return n.includes('nmfuncao') || n.includes('nm funcao') || n.includes('funcao');
      });
      if (funcaoKey) {
        const colaboradorIdx = colaboradorKey ? finalCols.indexOf(colaboradorKey) : -1;
        if (colaboradorIdx >= 0) {
          finalCols.splice(colaboradorIdx + 1, 0, funcaoKey);
        } else {
          // Se não encontrou colaborador, coloca após departamento ou regional
          const deptIdx = nmdepKey ? finalCols.indexOf(nmdepKey) : finalCols.indexOf('regional');
          finalCols.splice(deptIdx + 1, 0, funcaoKey);
        }
      }

      const peek = uk ? `unidKey=${uk} votes=${JSON.stringify(det.votes)}` : '';

      // Salva no state
      setColumns(finalCols);
      setRows(withReg);
      setUnidKey(uk);
      setVotePeek(peek);

      // Salva no cache
      setCache({
        batch_id: batchId,
        columns: finalCols,
        rows: withReg,
        unidKey: uk,
        votePeek: peek,
        timestamp: Date.now(),
      });

      markSessionLoaded();
      hasLoadedRef.current = true;
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  const clearData = () => {
    clearCache();
    setColumns([]);
    setRows([]);
    setUnidKey(null);
    setVotePeek('');
    hasLoadedRef.current = false;
  };

  return (
    <AlterdataContext.Provider
      value={{
        columns,
        rows,
        unidKey,
        votePeek,
        loading,
        error,
        progress,
        loadData,
        clearData,
      }}
    >
      {children}
    </AlterdataContext.Provider>
  );
}

export function useAlterdata() {
  const context = useContext(AlterdataContext);
  if (context === undefined) {
    throw new Error('useAlterdata deve ser usado dentro de AlterdataProvider');
  }
  return context;
}
