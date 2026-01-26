'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Flame, AlertTriangle, Clock, FileX, Search, ChevronLeft, ChevronRight, Edit2, Save, X } from 'lucide-react';

type ExtintorRow = {
  id: number;
  'Ano do Planejamento': number;
  TAG: string;
  Unidade: string;
  Local: string;
  Regional: string;
  Classe: string;
  'Massa/Volume (kg/L)': string;
  'TAG de Controle Mensal': string;
  'Data Tagueamento': string | null;
  'Lote Contrato': string;
  'Possui Contrato': string;
  'Nº série (Selo INMETRO)': string | null;
  'Última recarga': string | null;
  'Planej. Recarga': string | null;
  'Data Execução Recarga': string | null;
  // Campos calculados (nunca vêm do banco)
  status: 'OK' | 'A VENCER' | 'VENCIDO';
  dataLimiteRecarga: string | null;
  diasRestantes: number | null;
  mesPlanejRecarga: string | null;
  mesExecRecarga: string | null;
};

type StatsData = {
  total: number;
  totalVencidos: number;
  totalAVencer: number;
  totalSemContrato: number;
  porRegional: Record<string, number>;
};

type MetaRealData = {
  meta: number;
  real: Record<string, number>;
  total: number;
  ano: number;
};

const fetchJSON = async <T = any>(url: string, init?: RequestInit): Promise<T> => {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init });
    const data = await r.json();
    if (!r.ok) {
      const errorMsg = (data && (data.error || data.message)) || `Erro HTTP ${r.status}`;
      console.error('[fetchJSON] Erro na resposta:', { url, status: r.status, data });
      throw new Error(errorMsg);
    }
    if (!data.ok && data.error) {
      console.error('[fetchJSON] Erro no payload:', { url, error: data.error });
      throw new Error(data.error);
    }
    return data as T;
  } catch (error: any) {
    console.error('[fetchJSON] Erro na requisição:', { url, error: error.message });
    throw error;
  }
};

// Converte data dd/mm/yyyy para input date (yyyy-mm-dd)
function toInputDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// Converte input date (yyyy-mm-dd) para dd/mm/yyyy
function fromInputDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'VENCIDO':
      return 'bg-red-500/20 text-red-300 border-red-500/50';
    case 'A VENCER':
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
    case 'OK':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
    default:
      return 'bg-gray-500/20 text-gray-300 border-gray-500/50';
  }
}

export default function SPCIExtintoresPage() {
  // Filtros
  const [regional, setRegional] = useState<string>('');
  const [unidade, setUnidade] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [possuiContrato, setPossuiContrato] = useState<string>('');
  const [classe, setClasse] = useState<string>('');
  const [anoPlanejamento, setAnoPlanejamento] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // Dados
  const [rows, setRows] = useState<ExtintorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<string>('TAG');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Estatísticas
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Meta vs Real
  const [metaReal, setMetaReal] = useState<MetaRealData | null>(null);
  const [metaRealLoading, setMetaRealLoading] = useState(false);
  const [anoMetaReal, setAnoMetaReal] = useState<string>(String(new Date().getFullYear()));

  // Opções para filtros
  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [anos, setAnos] = useState<number[]>([]);

  // Edição inline
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<{
    planejRecarga: string;
    dataExecucaoRecarga: string;
    possuiContrato: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Carrega opções únicas
  useEffect(() => {
    fetchJSON<{ regionais: string[]; unidades: string[]; classes: string[]; anos: number[] }>('/api/spci/options')
      .then((data) => {
        setRegionais(data.regionais || []);
        setUnidades(data.unidades || []);
        setClasses(data.classes || []);
        setAnos(data.anos || []);
      })
      .catch(() => {});
  }, []);

  // Carrega estatísticas
  useEffect(() => {
    setStatsLoading(true);
    const params = new URLSearchParams();
    if (regional) params.set('regional', regional);
    if (unidade) params.set('unidade', unidade);

    fetchJSON<{ stats: StatsData }>(`/api/spci/stats?${params.toString()}`)
      .then((data) => setStats(data.stats))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [regional, unidade]);

  // Carrega Meta vs Real
  useEffect(() => {
    if (!regional) {
      setMetaReal(null);
      return;
    }

    setMetaRealLoading(true);
    const params = new URLSearchParams();
    params.set('regional', regional);
    params.set('ano', anoMetaReal);

    fetchJSON<MetaRealData>(`/api/spci/meta-real?${params.toString()}`)
      .then((data) => setMetaReal(data))
      .catch(() => setMetaReal(null))
      .finally(() => setMetaRealLoading(false));
  }, [regional, anoMetaReal]);

  // Carrega lista de extintores
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (regional) params.set('regional', regional);
    if (unidade) params.set('unidade', unidade);
    if (status) params.set('status', status);
    if (possuiContrato) params.set('possuiContrato', possuiContrato);
    if (classe) params.set('classe', classe);
    if (anoPlanejamento) params.set('anoPlanejamento', anoPlanejamento);
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);

    const url = `/api/spci/list?${params.toString()}`;
    console.log('[SPCI Page] Buscando dados:', url);
    
    fetchJSON<{ ok: boolean; rows: ExtintorRow[]; totalCount: number; error?: string }>(url)
      .then((data) => {
        console.log('[SPCI Page] Resposta completa:', data);
        if (data.ok === false) {
          console.error('[SPCI Page] API retornou erro:', data.error);
          setRows([]);
          setTotal(0);
          return;
        }
        console.log('[SPCI Page] Dados recebidos:', { rows: data.rows?.length || 0, total: data.totalCount || 0 });
        setRows(data.rows || []);
        setTotal(data.totalCount || 0);
      })
      .catch((error) => {
        console.error('[SPCI Page] Erro ao carregar extintores:', error);
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [regional, unidade, status, possuiContrato, classe, anoPlanejamento, search, page, pageSize, sortBy, sortDir]);

  // Unidades filtradas por regional
  const unidadesFiltradas = useMemo(() => {
    if (!regional) return unidades;
    return rows
      .filter((r) => r.Regional === regional)
      .map((r) => r.Unidade)
      .filter((u, i, arr) => arr.indexOf(u) === i)
      .sort();
  }, [regional, rows, unidades]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  };

  const startEdit = (row: ExtintorRow) => {
    setEditingId(row.id);
    setEditData({
      planejRecarga: toInputDate(row['Planej. Recarga']),
      dataExecucaoRecarga: toInputDate(row['Data Execução Recarga']),
      possuiContrato: row['Possui Contrato']?.toUpperCase() === 'SIM',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editData) return;

    setSaving(true);
    try {
      await fetchJSON('/api/spci/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          planejRecarga: editData.planejRecarga ? fromInputDate(editData.planejRecarga) : null,
          dataExecucaoRecarga: editData.dataExecucaoRecarga ? fromInputDate(editData.dataExecucaoRecarga) : null,
          possuiContrato: editData.possuiContrato,
        }),
      });

      // Recarrega dados
      const params = new URLSearchParams();
      if (regional) params.set('regional', regional);
      if (unidade) params.set('unidade', unidade);
      if (status) params.set('status', status);
      if (possuiContrato) params.set('possuiContrato', possuiContrato);
      if (classe) params.set('classe', classe);
      if (anoPlanejamento) params.set('anoPlanejamento', anoPlanejamento);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);

      const data = await fetchJSON<{ rows: ExtintorRow[]; totalCount: number }>(`/api/spci/list?${params.toString()}`);
      setRows(data.rows || []);
      setTotal(data.totalCount || 0);

      // Recarrega estatísticas
      const statsParams = new URLSearchParams();
      if (regional) statsParams.set('regional', regional);
      if (unidade) statsParams.set('unidade', unidade);
      const statsData = await fetchJSON<{ stats: StatsData }>(`/api/spci/stats?${statsParams.toString()}`);
      setStats(statsData.stats);

      setEditingId(null);
      setEditData(null);
    } catch (error: any) {
      alert('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <Flame className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-semibold">SPCI / Extintores</h1>
        </div>
        <p className="text-sm text-muted">
          Controle de equipamentos de combate a incêndio, inspeções e vencimentos.
        </p>
      </div>

      {/* Cards de Estatísticas */}
      {statsLoading ? (
        <div className="text-center py-4 text-muted">Carregando estatísticas...</div>
      ) : stats ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-panel p-4">
            <p className="text-[11px] text-muted flex items-center gap-1">
              <Flame className="w-3 h-3" />
              Total de Extintores
            </p>
            <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-panel p-4">
            <p className="text-[11px] text-muted flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              Vencidos
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-300">{stats.totalVencidos}</p>
          </div>
          <div className="rounded-xl border border-border bg-panel p-4">
            <p className="text-[11px] text-muted flex items-center gap-1">
              <Clock className="w-3 h-3 text-yellow-400" />
              A Vencer (30 dias)
            </p>
            <p className="mt-1 text-2xl font-semibold text-yellow-300">{stats.totalAVencer}</p>
          </div>
          <div className="rounded-xl border border-border bg-panel p-4">
            <p className="text-[11px] text-muted flex items-center gap-1">
              <FileX className="w-3 h-3 text-orange-400" />
              Sem Contrato
            </p>
            <p className="mt-1 text-2xl font-semibold text-orange-300">{stats.totalSemContrato}</p>
          </div>
          <div className="rounded-xl border border-border bg-panel p-4">
            <p className="text-[11px] text-muted">Por Regional</p>
            <div className="mt-1 text-xs space-y-1 max-h-16 overflow-y-auto">
              {Object.entries(stats.porRegional).map(([reg, count]) => (
                <div key={reg} className="flex justify-between">
                  <span className="text-muted">{reg}:</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Meta vs Real */}
      {regional && (
        <div className="rounded-xl border border-border bg-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Meta vs Real - {regional}</h2>
              <p className="text-[11px] text-muted">
                Meta: 0 extintores vencidos | Real: quantidade de extintores vencidos por mês
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={anoMetaReal}
                onChange={(e) => setAnoMetaReal(e.target.value)}
                className="px-2 py-1 rounded border border-border bg-bg text-text text-xs"
              >
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              {metaRealLoading && (
                <span className="text-[11px] text-muted">Carregando...</span>
              )}
            </div>
          </div>

          {metaReal && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-20 font-bold text-sm text-text">META</div>
                <div className="flex-1 grid grid-cols-12 gap-1">
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((mes) => (
                    <div key={mes} className="text-center text-xs font-medium text-text bg-muted/30 py-1.5 rounded">
                      0
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-20 font-bold text-sm text-emerald-600 dark:text-emerald-400">REAL</div>
                <div className="flex-1 grid grid-cols-12 gap-1">
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((mes, idx) => {
                    const quantidade = metaReal.real[mes] || 0;
                    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                    return (
                      <div
                        key={mes}
                        className={`text-center text-xs font-bold py-1.5 rounded ${
                          quantidade === 0
                            ? 'bg-emerald-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                        title={`${mesesNomes[idx]}: ${quantidade} extintor(es) vencido(s)`}
                      >
                        {quantidade}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <div className="w-20"></div>
                <div className="flex-1 grid grid-cols-12 gap-1">
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((mes, idx) => {
                    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                    return (
                      <div
                        key={mes}
                        className="px-2 py-1.5 rounded-lg text-[10px] font-medium text-center bg-panel border border-border text-text"
                        title={mesesNomes[idx]}
                      >
                        {mesesNomes[idx]}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {/* Busca por TAG ou Nº série */}
          <div className="lg:col-span-2">
            <label className="block text-xs text-muted mb-1">Buscar (TAG ou Nº série)</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Digite TAG ou Nº série..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* Regional */}
          <div>
            <label className="block text-xs text-muted mb-1">Regional</label>
            <select
              value={regional}
              onChange={(e) => {
                setRegional(e.target.value);
                setUnidade('');
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todas</option>
              {regionais.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Unidade */}
          <div>
            <label className="block text-xs text-muted mb-1">Unidade</label>
            <select
              value={unidade}
              onChange={(e) => {
                setUnidade(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todas</option>
              {unidadesFiltradas.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-muted mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todos</option>
              <option value="OK">OK</option>
              <option value="A VENCER">A Vencer</option>
              <option value="VENCIDO">Vencido</option>
            </select>
          </div>

          {/* Possui Contrato */}
          <div>
            <label className="block text-xs text-muted mb-1">Possui Contrato</label>
            <select
              value={possuiContrato}
              onChange={(e) => {
                setPossuiContrato(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todos</option>
              <option value="SIM">Sim</option>
              <option value="NÃO">Não</option>
            </select>
          </div>

          {/* Classe */}
          <div>
            <label className="block text-xs text-muted mb-1">Classe</label>
            <select
              value={classe}
              onChange={(e) => {
                setClasse(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todas</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Ano do Planejamento */}
          <div>
            <label className="block text-xs text-muted mb-1">Ano do Planejamento</label>
            <select
              value={anoPlanejamento}
              onChange={(e) => {
                setAnoPlanejamento(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todos</option>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-8 text-muted">Carregando...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted">Nenhum registro encontrado</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg/50 border-b border-border">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                    onClick={() => handleSort('TAG')}
                  >
                    TAG {sortBy === 'TAG' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                    onClick={() => handleSort('Unidade')}
                  >
                    Unidade {sortBy === 'Unidade' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                    onClick={() => handleSort('Regional')}
                  >
                    Regional {sortBy === 'Regional' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase">Local</th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                    onClick={() => handleSort('Classe')}
                  >
                    Classe {sortBy === 'Classe' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase">Massa/Vol</th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                    onClick={() => handleSort('Última recarga')}
                  >
                    Última Recarga {sortBy === 'Última recarga' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase">Data Limite</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase">Contrato</th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                    onClick={() => handleSort('Planej. Recarga')}
                  >
                    Planej. Recarga {sortBy === 'Planej. Recarga' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                    onClick={() => handleSort('Data Execução Recarga')}
                  >
                    Exec. Recarga {sortBy === 'Data Execução Recarga' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const isEditing = editingId === row.id;
                  const isVencido = row.status === 'VENCIDO';
                  const isAVencer = row.status === 'A VENCER';

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-bg/30 ${
                        isVencido ? 'bg-red-500/5' : isAVencer ? 'bg-yellow-500/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">{row.TAG}</td>
                      <td className="px-4 py-3">{row.Unidade}</td>
                      <td className="px-4 py-3">{row.Regional}</td>
                      <td className="px-4 py-3">{row.Local}</td>
                      <td className="px-4 py-3">{row.Classe}</td>
                      <td className="px-4 py-3">{row['Massa/Volume (kg/L)']}</td>
                      <td className="px-4 py-3">{row['Última recarga'] || '-'}</td>
                      <td className="px-4 py-3">{row.dataLimiteRecarga || '-'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing && editData ? (
                          <select
                            value={editData.possuiContrato ? 'SIM' : 'NÃO'}
                            onChange={(e) =>
                              setEditData({ ...editData, possuiContrato: e.target.value === 'SIM' })
                            }
                            className="w-full px-2 py-1 rounded border border-border bg-bg text-text text-xs"
                          >
                            <option value="SIM">SIM</option>
                            <option value="NÃO">NÃO</option>
                          </select>
                        ) : (
                          <div className="text-xs">{row['Possui Contrato']}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing && editData ? (
                          <input
                            type="date"
                            value={editData.planejRecarga}
                            onChange={(e) =>
                              setEditData({ ...editData, planejRecarga: e.target.value })
                            }
                            className="w-full px-2 py-1 rounded border border-border bg-bg text-text text-xs"
                          />
                        ) : (
                          <div>
                            <div className="text-xs">{row['Planej. Recarga'] || '-'}</div>
                            {row.mesPlanejRecarga && (
                              <div className="text-[10px] text-muted mt-0.5">{row.mesPlanejRecarga}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing && editData ? (
                          <input
                            type="date"
                            value={editData.dataExecucaoRecarga}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                dataExecucaoRecarga: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 rounded border border-border bg-bg text-text text-xs"
                          />
                        ) : (
                          <div>
                            <div className="text-xs">{row['Data Execução Recarga'] || '-'}</div>
                            {row.mesExecRecarga && (
                              <div className="text-[10px] text-muted mt-0.5">{row.mesExecRecarga}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 disabled:opacity-50"
                              title="Salvar"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="p-1 rounded hover:bg-red-500/20 text-red-400 disabled:opacity-50"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(row)}
                            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-bg/30">
          <div className="text-sm text-muted">
            Total: {total.toLocaleString()} | Página {page} de {pageCount}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-border bg-panel hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <ChevronLeft className="w-4 h-4 inline" />
            </button>
            <span className="text-sm text-muted">
              {page} / {pageCount}
            </span>
            <button
              onClick={() => setPage(Math.min(pageCount, page + 1))}
              disabled={page >= pageCount || loading}
              className="px-3 py-1.5 rounded-lg border border-border bg-panel hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <ChevronRight className="w-4 h-4 inline" />
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1.5 rounded-lg border border-border bg-panel text-sm"
            >
              <option value={10}>10/página</option>
              <option value={25}>25/página</option>
              <option value={50}>50/página</option>
              <option value={100}>100/página</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
