'use client';

import React, { useState } from 'react';
import { Download, Database, RefreshCw } from 'lucide-react';

export default function VerAlterdataPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function carregarEstrutura() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/alterdata/diagnostic', { cache: 'no-store' });
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao carregar dados');
      }
      
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Admin • Alterdata</p>
          <h1 className="mt-1 text-lg font-semibold">Estrutura da Tabela wdp.CAT</h1>
          <p className="mt-1 text-xs text-muted">
            Visualize a estrutura e uma amostra de dados da tabela wdp.CAT do SQL Server Alterdata
          </p>
        </div>
        <button
          onClick={carregarEstrutura}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Carregando...' : 'Carregar Estrutura'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Resumo */}
          <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-5 h-5 text-blue-500" />
              <h2 className="text-sm font-semibold">Informações da Tabela</h2>
            </div>
            <div className="grid gap-2 md:grid-cols-3 text-xs">
              <div>
                <span className="text-muted">Total de registros:</span>
                <span className="ml-2 font-semibold">{data.total?.toLocaleString('pt-BR') || 0}</span>
              </div>
              <div>
                <span className="text-muted">Total de colunas:</span>
                <span className="ml-2 font-semibold">{data.columns?.length || 0}</span>
              </div>
              <div>
                <span className="text-muted">Status:</span>
                <span className="ml-2 font-semibold text-emerald-600">Conectado</span>
              </div>
            </div>
          </div>

          {/* Estrutura das Colunas */}
          <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
            <h2 className="text-sm font-semibold mb-3">Estrutura das Colunas</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold">Nome da Coluna</th>
                    <th className="text-left px-3 py-2 font-semibold">Tipo de Dados</th>
                    <th className="text-left px-3 py-2 font-semibold">Permite NULL</th>
                    <th className="text-left px-3 py-2 font-semibold">Tamanho Máximo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.columns?.map((col: any, idx: number) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-card/50">
                      <td className="px-3 py-2 font-mono text-blue-600 dark:text-blue-400">
                        {col.COLUMN_NAME}
                      </td>
                      <td className="px-3 py-2 text-muted">{col.DATA_TYPE}</td>
                      <td className="px-3 py-2 text-muted">
                        {col.IS_NULLABLE === 'YES' ? 'Sim' : 'Não'}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {col.CHARACTER_MAXIMUM_LENGTH
                          ? `${col.CHARACTER_MAXIMUM_LENGTH} caracteres`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Amostra de Dados */}
          <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
            <h2 className="text-sm font-semibold mb-3">Amostra de Dados (Primeira Linha)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold">Campo</th>
                    <th className="text-left px-3 py-2 font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sampleRow &&
                    Object.entries(data.sampleRow).map(([key, value], idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-card/50">
                        <td className="px-3 py-2 font-mono text-blue-600 dark:text-blue-400">
                          {key}
                        </td>
                        <td className="px-3 py-2 break-all">
                          {value === null || value === undefined ? (
                            <span className="text-muted italic">NULL</span>
                          ) : typeof value === 'object' ? (
                            <span className="text-muted">{JSON.stringify(value)}</span>
                          ) : (
                            String(value)
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Instruções */}
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4 text-xs">
            <h3 className="font-semibold mb-2 text-amber-800 dark:text-amber-200">
              Como usar essas informações:
            </h3>
            <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-300">
              <li>
                Use os nomes exatos das colunas (primeira tabela) para ajustar o mapeamento no arquivo{' '}
                <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                  app/api/alterdata/import-acidentes/route.ts
                </code>
              </li>
              <li>
                Veja os valores reais na amostra (segunda tabela) para entender o formato dos dados
              </li>
              <li>
                O código já tenta várias variações de nomes automaticamente, mas você pode ajustar se necessário
              </li>
            </ul>
          </div>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="rounded-xl border border-border bg-panel p-8 text-center">
          <Database className="w-12 h-12 mx-auto text-muted mb-3" />
          <p className="text-sm text-muted">
            Clique em "Carregar Estrutura" para ver os dados da tabela wdp.CAT
          </p>
        </div>
      )}
    </div>
  );
}
