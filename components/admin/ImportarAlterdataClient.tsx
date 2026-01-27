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
  const [clearBeforeImport, setClearBeforeImport] = useState(false);
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
        setStatus({
          type: 'success',
          message: `✅ Importação concluída! ${j.total_rows || 0} registro(s) processado(s).${j.batchId ? ` Lote: ${j.batchId}` : ''}`,
        });
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
        <p className="text-sm text-muted mb-4">
          Envie o Excel (.xlsx) ou CSV da base Alterdata oficial. Apenas o administrador raiz pode
          executar esta operação.
        </p>
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
              className="block w-full text-sm rounded-xl border border-border bg-card px-4 py-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
            <p className="text-xs text-muted mt-2">
              Formatos aceitos: Excel (.xlsx) ou CSV. O sistema processa automaticamente a primeira aba/planilha.
            </p>
          </div>

          {/* Opção para limpar antes de importar */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={clearBeforeImport}
                onChange={(e) => setClearBeforeImport(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  ⚠️ Limpar dados existentes antes de importar
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Se marcado, todas as tabelas serão limpas antes de importar os novos dados. 
                  <strong className="block mt-1">Use isso se você notar que os dados estão duplicados ou acumulados.</strong>
                  {stats?.total_alterdata && (
                    <span className="block mt-1">
                      Atualmente há <strong>{stats.total_alterdata.toLocaleString()}</strong> registro(s) na base.
                    </span>
                  )}
                </div>
              </div>
            </label>
          </div>

          {/* Informações sobre colunas esperadas */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/10">
            <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
              📋 Colunas que o sistema busca no arquivo:
            </div>
            <div className="text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
              <p><strong>Colunas obrigatórias principais:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li><strong>CPF</strong> - Identificação do colaborador</li>
                <li><strong>Colaborador</strong> - Nome completo</li>
                <li><strong>Unidade Hospitalar</strong> - Unidade de lotação</li>
                <li><strong>Função</strong> - Cargo/função do colaborador</li>
              </ul>
              <p className="mt-2"><strong>Colunas opcionais (mas recomendadas):</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li><strong>Matrícula</strong> - Se não tiver, será gerada automaticamente</li>
                <li><strong>Admissão</strong> - Data de admissão (DD/MM/YYYY ou YYYY-MM-DD)</li>
                <li><strong>Demissão</strong> - Data de demissão, se houver</li>
              </ul>
              <p className="mt-2 text-emerald-600 dark:text-emerald-400">
                💡 <strong>Importante:</strong> O sistema é flexível e aceita variações de nomes de colunas. 
                Se seu arquivo tiver outras colunas além dessas, elas serão ignoradas, mas não causarão erro.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || !file}
            className="w-full rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
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
            className={`mt-4 rounded-xl border p-4 ${
              status.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
                : status.type === 'error'
                ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'
                : 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
            }`}
          >
            <div className="text-sm font-medium">{status.message}</div>
          </div>
        )}
      </div>

      {/* Estatísticas */}
      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">📊 Estatísticas da Base</h3>
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.raw_total !== undefined && (
              <div className="rounded-lg border border-blue-300 bg-blue-50/50 dark:bg-blue-900/20 p-3">
                <div className="text-xs text-muted mb-1">Total Importado (Raw)</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.raw_total.toLocaleString('pt-BR')}
                </div>
                <div className="text-[10px] text-muted mt-1">
                  Registros importados do arquivo
                </div>
              </div>
            )}
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted mb-1">Total Processado</div>
              <div className="text-2xl font-bold text-text">
                {stats.total_alterdata.toLocaleString('pt-BR')}
              </div>
              <div className="text-[10px] text-muted mt-1">
                Colaboradores na base oficial
              </div>
            </div>
            {stats.difference !== undefined && stats.difference > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50/50 dark:bg-amber-900/20 p-3">
                <div className="text-xs text-muted mb-1">Diferença</div>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.difference.toLocaleString('pt-BR')}
                </div>
                <div className="text-[10px] text-muted mt-1">
                  Registros não processados
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted mb-1">Total Manual</div>
              <div className="text-2xl font-bold text-text">
                {stats.total_manual.toLocaleString('pt-BR')}
              </div>
              <div className="text-[10px] text-muted mt-1">
                Colaboradores cadastrados manualmente
              </div>
            </div>

            <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/20 p-3">
              <div className="text-xs text-muted mb-1">Total Único</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.total_unique.toLocaleString('pt-BR')}
              </div>
              <div className="text-[10px] text-muted mt-1">
                Colaboradores únicos (sem duplicatas)
              </div>
            </div>

            <div className="rounded-lg border border-blue-300 bg-blue-50/50 dark:bg-blue-900/20 p-3">
              <div className="text-xs text-muted mb-1">Colaboradores Ativos</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.total_active.toLocaleString('pt-BR')}
              </div>
              <div className="text-[10px] text-muted mt-1">
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

      {/* Informações adicionais */}
      <div className="rounded-xl border border-border bg-panel p-4">
        <h3 className="text-sm font-semibold mb-2">ℹ️ Como funciona a atualização</h3>
        <ul className="text-xs text-muted space-y-1 list-disc list-inside">
          <li>Os dados são atualizados baseado em <strong>CPF + Matrícula</strong></li>
          <li>Se um colaborador já existe, os dados serão atualizados (nome, função, unidade, etc.)</li>
          <li>Novos colaboradores serão adicionados automaticamente</li>
          <li>O sistema processa em lotes para melhor performance</li>
          <li>Após a importação, os dados estarão disponíveis imediatamente no sistema</li>
        </ul>
      </div>
    </div>
  );
}
