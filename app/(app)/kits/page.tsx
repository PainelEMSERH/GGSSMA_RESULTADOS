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

  // Carrega dados do mapa de kits
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

        if (novasLinhas.length > 0) {
          setSelectedKey((prev) => {
            if (prev) {
              const stillExists = novasLinhas.some((r) => {
                const func = (r.funcao || '').trim();
                const un = (r.unidade || '').trim();
                const key = `${func}|||${un}`;
                return key === prev;
              });
              if (stillExists) return prev;
            }
            const first = novasLinhas[0];
            const func = (first.funcao || '').trim();
            const un = (first.unidade || '').trim();
            return `${func}|||${un}`;
          });
        } else {
          setSelectedKey(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Erro ao carregar dados');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [q, unidade, page]);

  // Agrupa linhas por função
  type GrupoFuncaoUnidade = {
    key: string;
    funcao: string;
    unidade: string;
    itens: KitMapRow[];
  };

  const gruposPorFuncao = useMemo<GrupoFuncaoUnidade[]>(() => {
    const map = new Map<string, GrupoFuncaoUnidade>();

    for (const row of rows) {
      const funcao = (row.funcao || 'SEM FUNÇÃO').trim();
      const unidade = (row.unidade || '—').trim();
      const key = `${funcao}|||${unidade}`;

      if (!map.has(key)) {
        map.set(key, { key, funcao, unidade, itens: [] });
      }
      map.get(key)!.itens.push(row);
    }

    const entries = Array.from(map.values());
    entries.sort((a, b) => {
      const byFunc = a.funcao.localeCompare(b.funcao, 'pt-BR');
      if (byFunc !== 0) return byFunc;
      return a.unidade.localeCompare(b.unidade, 'pt-BR');
    });

    return entries;
  }, [rows]);

  const funcoesResumo = useMemo(() => {
    let comKit = 0;
    let apenasSemEpi = 0;

    for (const grupo of gruposPorFuncao) {
      const temEpiReal = grupo.itens.some((i) => {
        const nome = (i.item || '').toUpperCase();
        const qtd = i.quantidade ?? 0;
        return nome !== 'SEM EPI' && qtd > 0;
      });

      if (temEpiReal) {
        comKit += 1;
      } else {
        apenasSemEpi += 1;
      }
    }

    return {
      funcoesTotal: gruposPorFuncao.length,
      comKit,
      apenasSemEpi,
    };
  }, [gruposPorFuncao]);

  const funcoesLista = useMemo(
    () =>
      gruposPorFuncao.map((grupo) => {
        const qtdItens = grupo.itens.length;
        const qtdTotal = grupo.itens.reduce((acc, it) => acc + (it.quantidade ?? 0), 0);
        const itensObrigatorios = grupo.itens.filter((it) => 
          isEpiObrigatorio(it.item) && (it.item || '').toUpperCase() !== 'SEM EPI'
        ).length;

        return {
          key: grupo.key,
          funcao: grupo.funcao,
          unidade: grupo.unidade,
          qtdItens,
          qtdTotal,
          itensObrigatorios,
        };
      }),
    [gruposPorFuncao],
  );

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE) || 1);

  const grupoSelecionado = useMemo(
    () => (selectedKey ? gruposPorFuncao.find((g) => g.key === selectedKey) || null : null),
    [selectedKey, gruposPorFuncao],
  );

  const funcaoSelecionada = grupoSelecionado?.itens ?? null;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            EPI • Kits
          </p>
          <h1 className="mt-1 text-lg font-semibold">Mapa de Kits por Função</h1>
          <p className="mt-1 text-xs text-muted">
            Visualize e consulte os kits de EPI configurados para cada função e unidade do sistema.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-panel px-4 py-2">
          <div className="text-right">
            <div className="text-xs text-muted">Funções com kit</div>
            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {funcoesResumo.comKit}
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-right">
            <div className="text-xs text-muted">Total de funções</div>
            <div className="text-sm font-semibold text-text">
              {funcoesResumo.funcoesTotal}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-panel p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted block mb-2">
              Buscar função ou EPI
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Ex.: Enfermeiro, Máscara N95..."
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-2">
              Filtrar por unidade
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Ex.: Hospital Regional..."
              value={unidade}
              onChange={(e) => {
                setPage(1);
                setUnidade(e.target.value);
              }}
            />
          </div>

          <div className="flex items-end">
            <div className="w-full rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted">Página</span>
                <span className="font-semibold text-text">
                  {page} / {totalPages}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="grid gap-6 lg:grid-cols-[1fr,420px]">
        {/* Lista de funções */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Funções Cadastradas</h2>
              <p className="text-xs text-muted mt-0.5">
                Clique em uma função para visualizar o kit completo
              </p>
            </div>
            {loading && (
              <div className="text-xs text-muted">Carregando...</div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          {!loading && funcoesLista.length === 0 && (
            <div className="rounded-xl border border-border bg-panel p-8 text-center">
              <p className="text-sm text-muted">
                Nenhuma função encontrada para os filtros informados.
              </p>
            </div>
          )}

          <div className="grid gap-3">
            {funcoesLista.map((funcao) => {
              const selecionada = funcao.key === selectedKey;
              return (
                <button
                  key={funcao.key}
                  type="button"
                  onClick={() => setSelectedKey(funcao.key)}
                  className={`group relative rounded-xl border-2 p-4 text-left transition-all ${
                    selecionada
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-md'
                      : 'border-border bg-panel hover:border-emerald-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-sm font-semibold truncate ${
                          selecionada ? 'text-emerald-700 dark:text-emerald-300' : 'text-text'
                        }`}>
                          {funcao.funcao}
                        </h3>
                        {selecionada && (
                          <span className="flex-shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-medium text-white">
                            Selecionada
                          </span>
                        )}
                      </div>
                      {funcao.unidade && funcao.unidade !== '—' && (
                        <p className="text-xs text-muted mb-2">
                          {funcao.unidade}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted">Itens:</span>
                          <span className="font-semibold text-text">{funcao.qtdItens}</span>
                        </div>
                        {funcao.itensObrigatorios > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted">Obrigatórios:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {funcao.itensObrigatorios}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      selecionada
                        ? 'bg-emerald-500 text-white'
                        : 'bg-muted text-muted-foreground group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:group-hover:bg-emerald-900/30 dark:group-hover:text-emerald-300'
                    }`}>
                      {selecionada ? 'Visualizando' : 'Ver kit'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-panel px-4 py-3">
              <div className="text-xs text-muted">
                Mostrando <span className="font-semibold text-text">{rows.length}</span> registros
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <span className="text-xs text-muted">
                  Página <span className="font-semibold text-text">{page}</span> de{' '}
                  <span className="font-semibold text-text">{totalPages}</span>
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Painel do kit selecionado */}
        <div className="lg:sticky lg:top-4 lg:h-fit">
          <div className="rounded-xl border border-border bg-panel">
            <div className="border-b border-border bg-muted/30 px-5 py-4">
              <h2 className="text-sm font-semibold">
                {grupoSelecionado ? (
                  <>
                    <div className="mb-1">{grupoSelecionado.funcao}</div>
                    {grupoSelecionado.unidade && grupoSelecionado.unidade !== '—' && (
                      <div className="text-xs font-normal text-muted">
                        {grupoSelecionado.unidade}
                      </div>
                    )}
                  </>
                ) : (
                  'Selecione uma função'
                )}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {grupoSelecionado
                  ? 'Kit completo de EPIs para esta função'
                  : 'Escolha uma função na lista ao lado para ver o kit'}
              </p>
            </div>

            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {loading && (
                <div className="px-5 py-12 text-center">
                  <div className="text-sm text-muted">Carregando kit...</div>
                </div>
              )}

              {!loading && !funcaoSelecionada && (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <svg
                      className="h-6 w-6 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-muted">
                    Selecione uma função para visualizar o kit
                  </p>
                </div>
              )}

              {!loading && funcaoSelecionada && (
                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-muted">
                        Total de itens no kit
                      </div>
                      <div className="text-lg font-semibold text-text">
                        {funcaoSelecionada.length}
                      </div>
                    </div>
                    {funcaoSelecionada.filter((it) => 
                      isEpiObrigatorio(it.item) && (it.item || '').toUpperCase() !== 'SEM EPI'
                    ).length > 0 && (
                      <div className="text-right">
                        <div className="text-xs font-medium text-muted">
                          EPIs obrigatórios
                        </div>
                        <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                          {funcaoSelecionada.filter((it) => 
                            isEpiObrigatorio(it.item) && (it.item || '').toUpperCase() !== 'SEM EPI'
                          ).length}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {funcaoSelecionada.map((item, idx) => {
                      const obrigatorio = isEpiObrigatorio(item.item);
                      const isSemEpi = (item.item || '').toUpperCase() === 'SEM EPI';
                      
                      return (
                        <div
                          key={`${item.item}-${idx}`}
                          className={`rounded-lg border p-3 transition-all ${
                            isSemEpi
                              ? 'border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900/30'
                              : obrigatorio
                              ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:border-emerald-800'
                              : 'border-border bg-card'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-sm font-medium ${
                                  isSemEpi ? 'text-muted line-through' : 'text-text'
                                }`}>
                                  {item.item || 'SEM EPI'}
                                </span>
                                {obrigatorio && !isSemEpi && (
                                  <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                    OBRIGATÓRIO
                                  </span>
                                )}
                              </div>
                              {item.unidade && item.unidade !== '—' && (
                                <div className="text-xs text-muted">
                                  Unidade: {item.unidade}
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              <div className="rounded-lg bg-muted px-3 py-1.5 text-center">
                                <div className="text-xs font-medium text-muted">Quantidade</div>
                                <div className="text-base font-bold text-text">
                                  {item.quantidade ?? 0}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
