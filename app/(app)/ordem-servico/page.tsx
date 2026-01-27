'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, CheckCircle2, XCircle, Search, Filter, RefreshCw, Download, Settings } from 'lucide-react';

type OrdemServicoRow = {
  id: string;
  nome: string;
  cpf: string; // mantido para ações (confirmar/desfazer), mas oculto na tabela
  matricula: string;
  unidade: string;
  regional: string;
  funcao: string;
  dataAdmissao: string | null;
  osEntregue: boolean;
  dataEntregaOS: string | null;
  responsavelEntrega: string | null;
};

type MetaRealData = {
  meta: Record<string, number>;
  metaMensal?: Record<string, number>;
  real: Record<string, number>;
  realAcumulado: Record<string, number>;
  totalColaboradores: number;
  totalMeta: number;
  totalReal: number;
  ano: number;
};

const fetchJSON = async <T = any>(url: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(url, { cache: 'no-store', ...init });
  const data = await r.json();
  if (!r.ok) {
    throw new Error((data && (data.error || data.message)) || 'Erro ao carregar dados');
  }
  return data as T;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  const s = String(iso).trim();
  if (!s) return '-';

  // Se já está no formato dd/mm/aaaa, só retorna
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  // Se estiver como yyyy-mm-dd, formata manualmente
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yyyy, mm, dd] = s.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR');
}

function maskCPF(cpf?: string) {
  const d = String(cpf || '').replace(/\D/g, '').padStart(11, '0').slice(-11);
  return d ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : '';
}

function formatMatricula(mat?: string) {
  const digits = String(mat || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(6, '0').slice(-6);
}

export default function OrdemServicoPage() {
  // Filtros
  const [regional, setRegional] = useState<string>('');
  const [unidade, setUnidade] = useState<string>('');
  const [entregue, setEntregue] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // Dados
  const [rows, setRows] = useState<OrdemServicoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<string>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Meta vs Real
  const [metaReal, setMetaReal] = useState<MetaRealData | null>(null);
  const [metaRealLoading, setMetaRealLoading] = useState(false);
  const [anoMetaReal, setAnoMetaReal] = useState<string>(String(new Date().getFullYear()));

  // Opções para filtros
  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<Array<{ unidade: string; regional: string }>>([]);

  // Modal de confirmação
  const [modalConfirmacao, setModalConfirmacao] = useState<{
    open: boolean;
    row: OrdemServicoRow | null;
  }>({ open: false, row: null });
  const [saving, setSaving] = useState(false);
  const [dataEntrega, setDataEntrega] = useState<string>('');

  // Carrega opções
  useEffect(() => {
    fetchJSON<{ regionais: string[]; unidades: Array<{ unidade: string; regional: string }> }>('/api/ordem-servico/options')
      .then((d) => {
        setRegionais(d.regionais || []);
        setUnidades(d.unidades || []);
      })
      .catch(() => {
        setRegionais([]);
        setUnidades([]);
      });
  }, []);

  // Carrega lista
  useEffect(() => {
    loadData();
  }, [regional, unidade, entregue, search, page, pageSize, sortBy, sortDir]);

  // Carrega Meta vs Real
  useEffect(() => {
    loadMetaReal();
  }, [regional, anoMetaReal]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (regional) params.set('regional', regional);
      if (unidade) params.set('unidade', unidade);
      if (entregue) params.set('entregue', entregue);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);

      const data = await fetchJSON<{ rows: OrdemServicoRow[]; total: number }>(`/api/ordem-servico/list?${params.toString()}`);
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMetaReal = async () => {
    setMetaRealLoading(true);
    try {
      const params = new URLSearchParams();
      if (regional) params.set('regional', regional);
      params.set('ano', anoMetaReal);

      const data = await fetchJSON<MetaRealData>(`/api/ordem-servico/meta-real?${params.toString()}`);
      setMetaReal(data);
    } catch (error: any) {
      console.error('Erro ao carregar meta/real:', error);
    } finally {
      setMetaRealLoading(false);
    }
  };

  const unidadesFiltradas = useMemo(() => {
    if (!regional) return unidades;
    return unidades
      .filter((u) => u.regional === regional)
      .map((u) => u.unidade)
      .filter((u, i, arr) => arr.indexOf(u) === i)
      .sort();
  }, [regional, unidades]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  };

  const abrirModalConfirmacao = (row: OrdemServicoRow) => {
    setModalConfirmacao({ open: true, row });
    setDataEntrega(row.dataEntregaOS || new Date().toISOString().split('T')[0]);
  };

  const fecharModalConfirmacao = () => {
    setModalConfirmacao({ open: false, row: null });
    setDataEntrega('');
  };

  const salvarConfirmacao = async () => {
    if (!modalConfirmacao.row) return;

    setSaving(true);
    try {
      await fetchJSON('/api/ordem-servico/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaboradorCpf: modalConfirmacao.row.cpf,
          entregue: true,
          dataEntrega: dataEntrega,
          responsavel: 'Sistema', // TODO: pegar do usuário logado
        }),
      });

      fecharModalConfirmacao();
      loadData();
      loadMetaReal();
    } catch (error: any) {
      alert('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const marcarNaoEntregue = async (row: OrdemServicoRow) => {
    if (!confirm('Deseja marcar como NÃO entregue?')) return;

    setSaving(true);
    try {
      await fetchJSON('/api/ordem-servico/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaboradorCpf: row.cpf,
          entregue: false,
          dataEntrega: null,
          responsavel: null,
        }),
      });

      loadData();
      loadMetaReal();
    } catch (error: any) {
      alert('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const exportarExcel = async () => {
    if (!rows.length) return;
    const { utils, writeFile } = await import('xlsx');

    const headers = [
      'Nome',
      'CPF',
      'Matrícula',
      'Unidade',
      'Regional',
      'Função',
      'Data Admissão',
      'OS Entregue',
      'Data Entrega OS',
      'Responsável Entrega',
    ];

    // Exporta sempre todos os campos, inclusive os que estão ocultos na tela (ex: CPF)
    const data = rows.map((r) => [
      r.nome,
      maskCPF(r.cpf),
      formatMatricula(r.matricula),
      r.unidade,
      r.regional,
      r.funcao,
      formatDate(r.dataAdmissao),
      r.osEntregue ? 'Sim' : 'Não',
      formatDate(r.dataEntregaOS),
      r.responsavelEntrega || '',
    ]);

    const ws = utils.aoa_to_sheet([headers, ...data]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'OrdemServico');
    writeFile(wb, `ordem-servico-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Ordem de Serviço
          </h1>
          <p className="text-sm text-muted mt-1">
            Colaboradores que iniciaram em 01/01/2026 - Controle de entrega de Ordem de Serviço
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportarExcel}
            className="p-2 rounded-lg border border-border bg-panel hover:bg-bg text-sm font-medium transition-colors flex items-center"
            title="Exportar para Excel"
            aria-label="Exportar para Excel"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => { loadData(); loadMetaReal(); }}
            disabled={loading || metaRealLoading}
            className="px-4 py-2 rounded-lg border border-border bg-panel hover:bg-bg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading || metaRealLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Card Meta vs Real */}
      {metaReal && (
        <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Meta vs Real - Ordem de Serviço</h2>
            <div className="flex items-center gap-2">
              <select
                value={anoMetaReal}
                onChange={(e) => setAnoMetaReal(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-bg text-sm"
              >
                {[2024, 2025, 2026, 2027].map((a) => (
                  <option key={a} value={String(a)}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-20 font-bold text-sm text-emerald-600 dark:text-emerald-400">META</div>
              <div className="flex-1 grid grid-cols-12 gap-1">
                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((mes, idx) => {
                  const quantidadeMeta = metaReal.meta[mes] || 0;
                  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                  return (
                    <div
                      key={mes}
                      className="text-center text-xs font-bold py-1.5 rounded bg-emerald-500 text-white"
                      title={`${mesesNomes[idx]}: ${quantidadeMeta} colaborador(es) devem ter recebido a OS`}
                    >
                      {quantidadeMeta}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-20 font-bold text-sm text-red-600 dark:text-red-400">REAL</div>
              <div className="flex-1 grid grid-cols-12 gap-1">
                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((mes, idx) => {
                  const quantidadeRealAcumulado = metaReal.realAcumulado?.[mes] || 0;
                  const quantidadeMeta = metaReal.meta[mes] || 0;
                  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                  const atingiuMeta = quantidadeRealAcumulado >= quantidadeMeta;
                  return (
                    <div
                      key={mes}
                      className={`text-center text-xs font-bold py-1.5 rounded ${
                        atingiuMeta
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}
                      title={`${mesesNomes[idx]}: ${quantidadeRealAcumulado} OS entregue(s) acumulado de ${quantidadeMeta} planejado(s) acumulado`}
                    >
                      {quantidadeRealAcumulado}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <div className="text-xs text-muted">
                Total: <span className="font-semibold text-text">{metaReal.totalReal}</span> de{' '}
                <span className="font-semibold text-text">{metaReal.totalMeta}</span> OS entregues
              </div>
              <div className="ml-auto text-xs text-muted">
                {metaReal.totalColaboradores} colaborador(es) que iniciaram em 01/01/2026
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">Regional</label>
            <select
              value={regional}
              onChange={(e) => {
                setRegional(e.target.value);
                setUnidade('');
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm"
            >
              <option value="">Todas</option>
              {regionais.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">Unidade</label>
            <select
              value={unidade}
              onChange={(e) => {
                setUnidade(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm"
              disabled={!regional}
            >
              <option value="">Todas</option>
              {unidadesFiltradas.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">Status</label>
            <select
              value={entregue}
              onChange={(e) => {
                setEntregue(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm"
            >
              <option value="">Todos</option>
              <option value="sim">OS Entregue</option>
              <option value="nao">OS Pendente</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Nome, CPF ou Matrícula"
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-border bg-bg text-sm"
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setRegional('');
                setUnidade('');
                setEntregue('');
                setSearch('');
                setPage(1);
              }}
              className="w-full px-4 py-2 rounded-lg border border-border bg-panel hover:bg-bg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-muted">
            <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
            <div>Carregando colaboradores...</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted mb-2">Nenhum registro encontrado</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-bg/50 border-b border-border">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                      onClick={() => handleSort('nome')}
                    >
                      Nome {sortBy === 'nome' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Matrícula</th>
                    <th
                      className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                      onClick={() => handleSort('unidade')}
                    >
                      Unidade {sortBy === 'unidade' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                      onClick={() => handleSort('regional')}
                    >
                      Regional {sortBy === 'regional' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Função</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Data Admissão</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Status OS</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-bg/30">
                      <td className="px-4 py-3 text-left text-[11px] font-medium">{row.nome}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{formatMatricula(row.matricula)}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{row.unidade}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{row.regional}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{row.funcao}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{formatDate(row.dataAdmissao)}</td>
                      <td className="px-4 py-3 text-center">
                        {row.osEntregue ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/50">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Entregue
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/50">
                            <XCircle className="w-3 h-3 mr-1" />
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {row.osEntregue ? (
                            <button
                              onClick={() => marcarNaoEntregue(row)}
                              className="px-2 py-1 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                              title="Marcar como não entregue"
                            >
                              Desfazer
                            </button>
                          ) : (
                            <button
                              onClick={() => abrirModalConfirmacao(row)}
                              className="px-2 py-1 rounded text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                              title="Confirmar entrega da OS"
                            >
                              Confirmar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="border-t border-border bg-bg/30 px-4 py-3 flex items-center justify-between">
              <div className="text-xs text-muted">
                Mostrando {rows.length} de {total} registro(s)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded border border-border bg-panel hover:bg-bg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-xs text-muted">
                  Página {page} de {Math.ceil(total / pageSize) || 1}
                </span>
                <button
                  onClick={() => setPage(Math.min(Math.ceil(total / pageSize), page + 1))}
                  disabled={page >= Math.ceil(total / pageSize)}
                  className="px-3 py-1 rounded border border-border bg-panel hover:bg-bg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próxima
                </button>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 rounded border border-border bg-panel text-xs"
                >
                  <option value={10}>10/página</option>
                  <option value={25}>25/página</option>
                  <option value={50}>50/página</option>
                  <option value={100}>100/página</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de Confirmação */}
      {modalConfirmacao.open && modalConfirmacao.row && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={fecharModalConfirmacao}>
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-panel shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border bg-card px-6 py-4 flex-shrink-0">
              <h2 className="text-lg font-semibold">Confirmar Entrega de Ordem de Serviço</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm font-medium text-muted mb-1">Colaborador</div>
                <div className="text-base font-semibold text-text">{modalConfirmacao.row.nome}</div>
                <div className="text-xs text-muted mt-0.5">
                  Matrícula: {modalConfirmacao.row.matricula}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted mb-1">Unidade</div>
                <div className="text-sm text-text">{modalConfirmacao.row.unidade}</div>
                <div className="text-xs text-muted mt-0.5">Regional: {modalConfirmacao.row.regional}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted block mb-1.5">Data de Entrega</label>
                <input
                  type="date"
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div className="border-t border-border bg-card px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                onClick={fecharModalConfirmacao}
                className="px-4 py-2 rounded-lg border border-border bg-panel hover:bg-bg text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarConfirmacao}
                disabled={saving || !dataEntrega}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Salvando...' : 'Confirmar Entrega'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
