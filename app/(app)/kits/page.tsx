'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { isEpiObrigatorio } from '@/data/epiObrigatorio';

type KitMapRow = {
  funcao: string;
  item: string;
  quantidade: number;
  unidade: string;
};

type KitMapResponse = {
  rows: KitMapRow[];
  total: number;
};

const fetchJSON = async <T = any>(url: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(url, { cache: 'no-store', ...init });
  const data = await r.json();
  if (!r.ok) {
    throw new Error((data && (data.error || data.message)) || 'Erro ao carregar dados');
  }
  return data as T;
};

const PAGE_SIZE = 400;

export default function KitsPage() {
  const [q, setQ] = useState('');
  const [unidade, setUnidade] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<KitMapRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (unidade.trim()) params.set('unidade', unidade.trim());
        params.set('page', String(page));
        params.set('size', String(PAGE_SIZE));

        const data = await fetchJSON<KitMapResponse>(`/api/kits/map?${params.toString()}`);

        if (cancelled) return;

        const novasLinhas = data?.rows ?? [];
        setRows(novasLinhas);
        setTotal(typeof data?.total === 'number' ? data.total : novasLinhas.length);

        if (novasLinhas.length === 0) setSelectedKey(null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Erro ao carregar dados');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [q, unidade, page]);

  type GrupoFuncaoUnidade = { key: string; funcao: string; unidade: string; itens: KitMapRow[] };

  const gruposPorFuncao = useMemo<GrupoFuncaoUnidade[]>(() => {
    const map = new Map<string, GrupoFuncaoUnidade>();
    for (const row of rows) {
      const funcao = (row.funcao || 'SEM FUNÇÃO').trim();
      const un = (row.unidade || '—').trim();
      const key = `${funcao}|||${un}`;
      if (!map.has(key)) map.set(key, { key, funcao, unidade: un, itens: [] });
      map.get(key)!.itens.push(row);
    }
    const entries = Array.from(map.values());
    entries.sort((a, b) => {
      const byF = a.funcao.localeCompare(b.funcao, 'pt-BR');
      return byF !== 0 ? byF : a.unidade.localeCompare(b.unidade, 'pt-BR');
    });
    return entries;
  }, [rows]);

  const funcoesResumo = useMemo(() => {
    let comKit = 0;
    for (const g of gruposPorFuncao) {
      if (g.itens.some((i) => (i.item || '').toUpperCase() !== 'SEM EPI' && (i.quantidade ?? 0) > 0)) comKit++;
    }
    return { funcoesTotal: gruposPorFuncao.length, comKit };
  }, [gruposPorFuncao]);

  const funcoesLista = useMemo(
    () =>
      gruposPorFuncao.map((g) => {
        const itensObrig = g.itens.filter(
          (it) => isEpiObrigatorio(it.item) && (it.item || '').toUpperCase() !== 'SEM EPI'
        ).length;
        return {
          key: g.key,
          funcao: g.funcao,
          unidade: g.unidade,
          qtdItens: g.itens.length,
          qtdTotal: g.itens.reduce((a, it) => a + (it.quantidade ?? 0), 0),
          itensObrigatorios: itensObrig,
        };
      }),
    [gruposPorFuncao],
  );

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE) || 1);
  const grupoSelecionado = useMemo(
    () => (selectedKey ? gruposPorFuncao.find((g) => g.key === selectedKey) ?? null : null),
    [selectedKey, gruposPorFuncao],
  );
  const itensKit = grupoSelecionado?.itens ?? null;

  const abrirKit = (key: string) => setSelectedKey(key);
  const fecharKit = () => setSelectedKey(null);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">EPI • Kits</p>
          <h1 className="mt-1 text-lg font-semibold">Mapa de Kits por Função</h1>
          <p className="mt-1 text-xs text-muted">
            Consulte os kits de EPI por função e unidade. Clique em &quot;Ver kit&quot; para abrir o detalhe.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-panel px-4 py-2.5">
          <div className="text-right">
            <div className="text-[11px] text-muted">Com kit</div>
            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {funcoesResumo.comKit}
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-right">
            <div className="text-[11px] text-muted">Total</div>
            <div className="text-sm font-semibold text-text">{funcoesResumo.funcoesTotal}</div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-panel p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Função ou EPI</label>
            <input
              type="text"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Ex.: Enfermeiro, Máscara N95..."
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Unidade</label>
            <input
              type="text"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Ex.: PCG UNIVERSAL, Hospital..."
              value={unidade}
              onChange={(e) => { setPage(1); setUnidade(e.target.value); }}
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <div className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
              <span className="text-muted">Página</span>
              <span className="font-semibold text-text">{page} / {totalPages}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela principal */}
      <div className="rounded-xl border border-border bg-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Funções e unidades</h2>
          <p className="text-xs text-muted">Clique na linha ou em &quot;Ver kit&quot; para abrir o kit ao lado.</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 px-4 py-12">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <span className="text-sm text-muted">Carregando...</span>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {!loading && funcoesLista.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted">
            Nenhuma função encontrada para os filtros informados.
          </div>
        )}

        {!loading && funcoesLista.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm" style={{ fontSize: '13px' }}>
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 font-semibold text-text">Função</th>
                  <th className="px-4 py-2.5 font-semibold text-text">Unidade</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-text">Itens</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-text">Obrig.</th>
                  <th className="px-4 py-2.5 font-semibold text-text">Ação</th>
                </tr>
              </thead>
              <tbody>
                {funcoesLista.map((f) => {
                  const sel = f.key === selectedKey;
                  return (
                    <tr
                      key={f.key}
                      onClick={() => abrirKit(f.key)}
                      className={`cursor-pointer border-b border-border transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 ${
                        sel ? 'bg-emerald-50/80 dark:bg-emerald-900/20' : 'bg-panel/40'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium text-text">{f.funcao}</td>
                      <td className="px-4 py-2.5 text-muted">{f.unidade === '—' ? '—' : f.unidade}</td>
                      <td className="px-4 py-2.5 text-center text-text">{f.qtdItens}</td>
                      <td className="px-4 py-2.5 text-center">
                        {f.itensObrigatorios > 0 ? (
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">{f.itensObrigatorios}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); abrirKit(f.key); }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                            sel
                              ? 'bg-emerald-500 text-white'
                              : 'bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300'
                          }`}
                        >
                          {sel ? 'Aberto' : 'Ver kit'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <span className="text-xs text-muted">
              <span className="font-semibold text-text">{rows.length}</span> registros
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span className="text-xs text-muted">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer do kit */}
      {grupoSelecionado && itensKit && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 transition-opacity"
            aria-hidden="true"
            onClick={fecharKit}
          />
          <aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-panel shadow-xl"
            role="dialog"
            aria-labelledby="drawer-title"
          >
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 id="drawer-title" className="truncate text-sm font-semibold text-text">
                  {grupoSelecionado.funcao}
                </h2>
                <p className="truncate text-xs text-muted">
                  {grupoSelecionado.unidade === '—' ? 'Unidade não informada' : grupoSelecionado.unidade}
                </p>
              </div>
              <button
                type="button"
                onClick={fecharKit}
                className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted transition hover:bg-muted hover:text-text"
                aria-label="Fechar"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 border-b border-border px-4 py-2 text-xs">
              <div>
                <span className="text-muted">Itens: </span>
                <span className="font-semibold text-text">{itensKit.length}</span>
              </div>
              {itensKit.some((it) => isEpiObrigatorio(it.item) && (it.item || '').toUpperCase() !== 'SEM EPI') && (
                <div>
                  <span className="text-muted">Obrig.: </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {itensKit.filter((it) => isEpiObrigatorio(it.item) && (it.item || '').toUpperCase() !== 'SEM EPI').length}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="min-w-full text-left" style={{ fontSize: '12px' }}>
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-semibold text-text">Item</th>
                    <th className="w-16 px-2 py-2 text-center font-semibold text-text">Obrig.</th>
                    <th className="w-14 px-2 py-2 text-center font-semibold text-text">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {itensKit.map((it, idx) => {
                    const obrig = isEpiObrigatorio(it.item);
                    const semEpi = (it.item || '').toUpperCase() === 'SEM EPI';
                    return (
                      <tr
                        key={`${it.item}-${idx}`}
                        className={`border-b border-border/60 ${
                          semEpi ? 'bg-neutral-50/50 dark:bg-neutral-900/20' : obrig ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''
                        }`}
                      >
                        <td className="px-3 py-2">
                          <span className={semEpi ? 'text-muted line-through' : 'text-text'}>
                            {it.item || 'SEM EPI'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          {obrig && !semEpi ? (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              Sim
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center font-medium text-text">{it.quantidade ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
