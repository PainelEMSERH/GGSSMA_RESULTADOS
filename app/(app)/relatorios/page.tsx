'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { REPORT_MODULES, ReportColumn, ReportFilters } from '@/lib/relatorios/config';

type SelectedModule = {
  id: string;
  selectedColumns: string[];
};

export default function RelatoriosPage() {
  const [opts, setOpts] = useState<{ regionais: string[]; unidades: { unidade: string; regional: string }[] }>({ 
    regionais: [], 
    unidades: [] 
  });
  const [optsLoading, setOptsLoading] = useState(false);

  const [filters, setFilters] = useState<ReportFilters>(() => {
    const now = new Date();
    const ate = now.toISOString().slice(0, 10);
    const deDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const de = deDate.toISOString().slice(0, 10);
    return { regional: '', unidade: '', de, ate };
  });

  const [selectedModules, setSelectedModules] = useState<SelectedModule[]>(() => {
    // Por padrão, seleciona o módulo de Entregas com todas as colunas principais
    const entregasModule = REPORT_MODULES.find(m => m.id === 'entregas');
    if (entregasModule) {
      return [{
        id: 'entregas',
        selectedColumns: ['cpf', 'nome', 'funcao', 'unidade', 'regional', 'item', 'quantidade', 'data_entrega']
      }];
    }
    return [];
  });

  const [expandedModule, setExpandedModule] = useState<string | null>('entregas');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadOpts() {
      setOptsLoading(true);
      try {
        const res = await fetch('/api/entregas/options', { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        setOpts({ 
          regionais: json.regionais || [], 
          unidades: json.unidades || [] 
        });
      } finally {
        if (!cancelled) setOptsLoading(false);
      }
    }
    loadOpts();
    return () => { cancelled = true; };
  }, []);

  const unidadesFiltradas = useMemo(() => {
    if (!filters.regional) return opts.unidades || [];
    return (opts.unidades || []).filter((u) => 
      (u.regional || '').toString().toUpperCase() === (filters.regional || '').toUpperCase()
    );
  }, [opts.unidades, filters.regional]);

  const enabledModules = useMemo(() => {
    return REPORT_MODULES.filter(m => m.enabled);
  }, []);

  function toggleModule(moduleId: string) {
    setSelectedModules(prev => {
      const exists = prev.find(m => m.id === moduleId);
      if (exists) {
        return prev.filter(m => m.id !== moduleId);
      } else {
        const module = REPORT_MODULES.find(m => m.id === moduleId);
        if (!module) return prev;
        // Seleciona colunas principais por padrão
        const mainColumns = module.columns.slice(0, 6).map(c => c.id);
        return [...prev, { id: moduleId, selectedColumns: mainColumns }];
      }
    });
  }

  function toggleColumn(moduleId: string, columnId: string) {
    setSelectedModules(prev => prev.map(m => {
      if (m.id !== moduleId) return m;
      const hasColumn = m.selectedColumns.includes(columnId);
      return {
        ...m,
        selectedColumns: hasColumn
          ? m.selectedColumns.filter(c => c !== columnId)
          : [...m.selectedColumns, columnId]
      };
    }));
  }

  function selectAllColumns(moduleId: string) {
    const module = REPORT_MODULES.find(m => m.id === moduleId);
    if (!module) return;
    setSelectedModules(prev => prev.map(m => 
      m.id === moduleId 
        ? { ...m, selectedColumns: module.columns.map(c => c.id) }
        : m
    ));
  }

  function deselectAllColumns(moduleId: string) {
    setSelectedModules(prev => prev.map(m => 
      m.id === moduleId 
        ? { ...m, selectedColumns: [] }
        : m
    ));
  }

  async function handleGenerate() {
    if (selectedModules.length === 0) {
      alert('Selecione pelo menos um módulo para gerar o relatório.');
      return;
    }

    // Valida se cada módulo tem pelo menos uma coluna selecionada
    for (const mod of selectedModules) {
      if (mod.selectedColumns.length === 0) {
        alert(`O módulo "${REPORT_MODULES.find(m => m.id === mod.id)?.name}" precisa ter pelo menos uma coluna selecionada.`);
        return;
      }
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/relatorios/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modules: selectedModules,
          filters,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar relatório');
      }

      // Download do arquivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatorio_EMSERH_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      alert(`Erro ao gerar relatório: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            EPI • Relatórios
          </p>
          <h1 className="mt-1 text-lg font-semibold">Relatórios Personalizados</h1>
          <p className="mt-1 text-xs text-muted">
            Personalize as colunas e módulos que deseja incluir no relatório Excel. 
            Selecione exatamente o que precisa ver nos dados.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold mb-4">Filtros do Relatório</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-muted block mb-2">
              Regional
            </label>
            <select
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={filters.regional || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, regional: e.target.value, unidade: '' }))}
            >
              <option value="">Todas as Regionais</option>
              {opts.regionais.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-2">
              Unidade
            </label>
            <select
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={filters.unidade || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, unidade: e.target.value }))}
              disabled={!filters.regional}
            >
              <option value="">Todas as Unidades</option>
              {unidadesFiltradas.map((u) => (
                <option key={u.unidade} value={u.unidade}>{u.unidade}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={filters.de || ''}
              max={filters.ate || undefined}
              onChange={(e) => setFilters(prev => ({ ...prev, de: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-2">
              Data Final
            </label>
            <input
              type="date"
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={filters.ate || ''}
              min={filters.de || undefined}
              onChange={(e) => setFilters(prev => ({ ...prev, ate: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Seleção de Módulos e Colunas */}
      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Módulos e Colunas do Relatório</h2>
          <div className="text-xs text-muted">
            {selectedModules.length} módulo(s) selecionado(s)
          </div>
        </div>

        <div className="space-y-3">
          {enabledModules.map((module) => {
            const isSelected = selectedModules.some(m => m.id === module.id);
            const selectedModule = selectedModules.find(m => m.id === module.id);
            const isExpanded = expandedModule === module.id;

            return (
              <div
                key={module.id}
                className={`rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10'
                    : 'border-border bg-card'
                }`}
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => {
                    if (!isSelected) toggleModule(module.id);
                    setExpandedModule(isExpanded ? null : module.id);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleModule(module.id);
                        if (!isSelected) setExpandedModule(module.id);
                      }}
                      className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{module.icon}</span>
                        <span className="text-sm font-semibold">{module.name}</span>
                      </div>
                      <p className="text-xs text-muted mt-0.5">{module.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {selectedModule?.selectedColumns.length || 0} coluna(s) selecionada(s)
                      </span>
                    )}
                    <svg
                      className={`h-5 w-5 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isSelected && isExpanded && (
                  <div className="border-t border-border bg-panel p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-medium text-muted">
                        Selecione as colunas que deseja incluir:
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => selectAllColumns(module.id)}
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                        >
                          Selecionar todas
                        </button>
                        <button
                          type="button"
                          onClick={() => deselectAllColumns(module.id)}
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {module.columns.map((column) => {
                        const isColumnSelected = selectedModule?.selectedColumns.includes(column.id) || false;
                        return (
                          <label
                            key={column.id}
                            className="flex items-start gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isColumnSelected}
                              onChange={() => toggleColumn(module.id, column.id)}
                              className="mt-0.5 h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-text">{column.label}</div>
                              {column.description && (
                                <div className="text-[10px] text-muted mt-0.5">{column.description}</div>
                              )}
                              <div className="text-[10px] text-muted mt-0.5">
                                Tipo: {column.type} • Largura: {column.width || 15}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {enabledModules.length === 0 && (
          <div className="text-center py-8 text-sm text-muted">
            Nenhum módulo disponível no momento.
          </div>
        )}
      </div>

      {/* Botão de Gerar */}
      <div className="flex items-center justify-end gap-4">
        <div className="text-xs text-muted">
          {selectedModules.reduce((acc, m) => acc + m.selectedColumns.length, 0)} coluna(s) total selecionada(s)
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || selectedModules.length === 0}
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Gerando Excel...
            </span>
          ) : (
            '📊 Gerar Relatório Excel'
          )}
        </button>
      </div>

      {/* Informações */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/10">
        <div className="flex items-start gap-3">
          <div className="text-emerald-600 dark:text-emerald-400 text-xl">ℹ️</div>
          <div className="flex-1 text-xs text-emerald-800 dark:text-emerald-200">
            <div className="font-semibold mb-1">Como usar:</div>
            <ul className="list-disc list-inside space-y-1 text-emerald-700 dark:text-emerald-300">
              <li>Selecione os módulos que deseja incluir no relatório (cada módulo será uma aba no Excel)</li>
              <li>Para cada módulo, escolha as colunas específicas que precisa visualizar</li>
              <li>Aplique os filtros desejados (Regional, Unidade, Período)</li>
              <li>Clique em "Gerar Relatório Excel" para baixar o arquivo</li>
              <li>O arquivo Excel terá uma aba para cada módulo selecionado</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
