'use client';
import React, { useState, useEffect } from 'react';

type Stats = {
  raw_total?: number;
  total_alterdata: number;
  raw_no_cpf?: number;
  total_manual: number;
  total_unique: number;
  total_active: number;
  difference?: number;
  last_import: {
    batch_id: string;
    source_file: string;
    total_rows: number;
    imported_by: string;
    imported_at: string;
  } | null;
};

export default function ImportarAlterdataClient() {
  const [file, setFile] = useState<File | null>(null);
  const [clearBeforeImport, setClearBeforeImport] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoadingStats(true);
      const res = await fetch('/api/alterdata/stats', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok && json.stats) {
        setStats(json.stats);
      }
    } catch (e) {
      console.error('Erro ao carregar estatísticas', e);
    } finally {
      setLoadingStats(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setStatus({ type: 'error', message: 'Escolha um arquivo .xlsx ou .csv' });
      return;
    }
    setBusy(true);
    setStatus({ type: 'info', message: 'Enviando e processando arquivo...' });
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (clearBeforeImport) {
        fd.append('clearBeforeImport', 'true');
      }
      const r = await fetch('/api/alterdata/import', {
        method: 'POST',
        body: fd,
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setStatus({
          type: 'error',
          message: 'Erro ao importar: ' + (j?.error || 'verifique o arquivo e tente novamente.'),
        });
      } else {
        const msg = j.message
          ? `✅ ${j.message} (${j.total_rows ?? 0} registro(s).)`
          : `✅ Importação concluída! ${j.total_rows || 0} registro(s) processado(s).${j.batchId ? ` Lote: ${j.batchId}` : ''}`;
        setStatus({ type: 'success', message: msg });
        // Limpa o formulário
        setFile(null);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        // Recarrega estatísticas
        await loadStats();
      }
    } catch (e: any) {
      setStatus({
        type: 'error',
        message: 'Erro inesperado ao enviar o arquivo: ' + (e?.message || 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">Importar Alterdata</h2>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold block mb-2">
              Arquivo para importar:
            </label>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setStatus(null);
              }}
              className="block w-full text-xs rounded-lg border border-border bg-card px-3 py-2 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-card file:text-text hover:file:bg-bg"
            />
            <p className="text-xs text-muted mt-2">
              Formatos aceitos: Excel (.xlsx) ou CSV. O sistema processa automaticamente a primeira aba/planilha.
            </p>
          </div>

          {/* Opção para limpar antes de importar - versão compacta */}
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-muted">
            <input
              type="checkbox"
              checked={clearBeforeImport}
              onChange={(e) => setClearBeforeImport(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <span>Limpar base antes de importar (usar só quando precisar zerar tudo).</span>
          </label>

          <button
            type="submit"
            disabled={busy || !file}
            className="w-full rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Importar arquivo Alterdata"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processando...
              </span>
            ) : (
              '📤 Importar Alterdata'
            )}
          </button>
        </form>

        {/* Status */}
        {status && (
          <div
            className={`mt-3 rounded-lg border p-3 ${
              status.type === 'success'
                ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200'
                : status.type === 'error'
                ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'
                : 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="text-xs font-medium">{status.message}</div>
          </div>
        )}
      </div>

      {/* Estatísticas */}
      <div className="rounded-xl border border-border bg-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold">📊 Estatísticas da Base</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/alterdata/diagnostic', { cache: 'no-store' });
                  const json = await res.json();
                  if (json.ok && json.diagnostic) {
                    const diag = json.diagnostic;
                    alert(
                      `Diagnóstico:\n\n` +
                      `Total importado (raw): ${diag.raw_total.toLocaleString('pt-BR')}\n` +
                      `Total processado: ${diag.processed_total.toLocaleString('pt-BR')}\n` +
                      `Diferença: ${diag.difference.toLocaleString('pt-BR')}\n\n` +
                      `Sem CPF (raw): ${diag.raw_no_cpf.toLocaleString('pt-BR')}\n` +
                      `Sem CPF (processado): ${diag.processed_no_cpf.toLocaleString('pt-BR')}\n` +
                      `Duplicatas: ${diag.duplicates.duplicates_count.toLocaleString('pt-BR')}\n` +
                      `Não processados: ${diag.not_processed.toLocaleString('pt-BR')}`
                    );
                  }
                } catch (e) {
                  alert('Erro ao buscar diagnóstico');
                }
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
            >
              🔍 Diagnóstico
            </button>
            <button
              type="button"
              onClick={loadStats}
              disabled={loadingStats}
              className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50"
            >
              {loadingStats ? 'Atualizando...' : '🔄 Atualizar'}
            </button>
          </div>
        </div>

        {loadingStats && !stats && (
          <div className="text-sm text-muted">Carregando estatísticas...</div>
        )}

        {stats && (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5 min-w-0">
            {stats.raw_total !== undefined && (
              <div className="rounded-lg border border-border bg-card p-2 min-w-0">
                <div className="text-[10px] text-muted mb-0.5 truncate" title="Total Importado (Raw)">Total Importado (Raw)</div>
                <div className="text-base font-bold text-text leading-tight">
                  {stats.raw_total.toLocaleString('pt-BR')}
                </div>
                <div className="text-[9px] text-muted mt-0.5 line-clamp-2">
                  Registros importados do arquivo
                </div>
              </div>
            )}
            <div className="rounded-lg border border-border bg-card p-2 min-w-0">
              <div className="text-[10px] text-muted mb-0.5">Total Processado</div>
              <div className="text-base font-bold text-text leading-tight">
                {stats.total_alterdata.toLocaleString('pt-BR')}
              </div>
              <div className="text-[9px] text-muted mt-0.5 line-clamp-2">
                Colaboradores na base oficial
              </div>
            </div>
            {stats.difference !== undefined && stats.difference > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50/50 dark:bg-amber-900/20 p-2 min-w-0">
                <div className="text-[10px] text-muted mb-0.5">Diferença</div>
                <div className="text-base font-bold text-amber-600 dark:text-amber-400 leading-tight">
                  {stats.difference.toLocaleString('pt-BR')}
                </div>
                <div className="text-[9px] text-muted mt-0.5 line-clamp-2">
                  Registros não processados
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border bg-card p-2 min-w-0">
              <div className="text-[10px] text-muted mb-0.5">Total Manual</div>
              <div className="text-base font-bold text-text leading-tight">
                {stats.total_manual.toLocaleString('pt-BR')}
              </div>
              <div className="text-[9px] text-muted mt-0.5 line-clamp-2">
                Colaboradores cadastrados manualmente
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-2 min-w-0">
              <div className="text-[10px] text-muted mb-0.5">Total Único</div>
              <div className="text-base font-bold text-text leading-tight">
                {stats.total_unique.toLocaleString('pt-BR')}
              </div>
              <div className="text-[9px] text-muted mt-0.5 line-clamp-2">
                Colaboradores únicos (sem duplicatas)
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-2 min-w-0">
              <div className="text-[10px] text-muted mb-0.5">Colaboradores Ativos</div>
              <div className="text-base font-bold text-text leading-tight">
                {stats.total_active.toLocaleString('pt-BR')}
              </div>
              <div className="text-[9px] text-muted mt-0.5 line-clamp-2">
                Sem demissão ou demitidos após 2025
              </div>
            </div>
          </div>
        )}

        {stats?.last_import && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs font-semibold text-muted mb-2">Última Importação:</div>
            <div className="text-xs text-muted space-y-1">
              <div>
                <strong>Arquivo:</strong> {stats.last_import.source_file}
              </div>
              <div>
                <strong>Registros:</strong> {stats.last_import.total_rows.toLocaleString('pt-BR')}
              </div>
              <div>
                <strong>Importado por:</strong> {stats.last_import.imported_by}
              </div>
              <div>
                <strong>Data:</strong>{' '}
                {new Date(stats.last_import.imported_at).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Informações adicionais removidas para deixar a tela mais limpa */}
    </div>
  );
}
