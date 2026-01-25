'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { REGIONALS } from '@/lib/unidReg';
import { AlertTriangle, ChevronDown, ChevronUp, Eye, EyeOff, Plus, Search } from 'lucide-react';

type AcidenteRow = {
  id: string;
  nome: string;
  empresa: 'IADVH' | 'EMSERH';
  unidadeHospitalar: string;
  regional: string | null;
  tipo: string;
  comAfastamento: boolean;
  data: string;
  hora: string | null;
  mes: number;
  ano: number;
  numeroCAT: string | null;
  riat: string | null;
  sinan: string | null;
  status: string;
  descricao: string | null;
};

type StatsData = {
  totalAno: number;
  totalMes: number;
  porRegional: Array<{ regional: string; quantidade: number }>;
  porTipo: Array<{ tipo: string; quantidade: number }>;
  porUnidade: Array<{ unidade: string; quantidade: number }>;
  porMes: Record<string, number>;
  porStatus: Array<{ status: string; quantidade: number }>;
  comAfastamento: number;
  semAfastamento: number;
};

type MetaRealData = {
  meta: number;
  real: Record<string, number>;
  total: number;
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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function formatDateTime(iso: string | null | undefined, hora: string | null | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const dateStr = d.toLocaleDateString('pt-BR');
  return hora ? `${dateStr} ${hora}` : dateStr;
}

function toInputDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TIPOS_ACIDENTE = [
  { value: 'biologico', label: 'Biológico' },
  { value: 'trajeto', label: 'Trajeto' },
  { value: 'tipico', label: 'Típico' },
  { value: 'de_trabalho', label: 'De Trabalho' },
  { value: 'outros', label: 'Outros' },
];

const STATUS_ACIDENTE = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
];

const LS_REGIONAL_KEY = 'acidentes:regional';

export default function AcidentesPage() {
  const [tab, setTab] = useState<'registros' | 'visao'>('registros');

  // Filtros
  const [regional, setRegional] = useState<string>('');
  const [unidade, setUnidade] = useState<string>('');
  const [tipo, setTipo] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [empresa, setEmpresa] = useState<string>('');
  const [ano, setAno] = useState<string>(String(new Date().getFullYear()));
  const [mes, setMes] = useState<string>('');
  const [q, setQ] = useState<string>('');

  // Dados
  const [rows, setRows] = useState<AcidenteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(false);

  // Opções
  const [opts, setOpts] = useState<{ regionais: string[]; unidades: Array<{ unidade: string; regional: string }> }>({
    regionais: [],
    unidades: [],
  });

  // Modal de edição/criação
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AcidenteRow | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    empresa: 'EMSERH' as 'IADVH' | 'EMSERH',
    unidadeHospitalar: '',
    regional: '',
    tipo: '',
    comAfastamento: false,
    data: '',
    hora: '',
    numeroCAT: '',
    riat: '',
    sinan: '',
    status: 'aberto',
    descricao: '',
  });
  const [saving, setSaving] = useState(false);

  // Detalhes expandidos
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Visão Geral
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [metaReal, setMetaReal] = useState<MetaRealData | null>(null);
  const [metaRealLoading, setMetaRealLoading] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);

  // Carrega regional do localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(LS_REGIONAL_KEY);
    if (stored && REGIONALS.includes(stored as any)) {
      setRegional(stored);
    }
  }, []);

  // Salva regional no localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (regional) {
      window.localStorage.setItem(LS_REGIONAL_KEY, regional);
    }
  }, [regional]);

  // Carrega opções
  useEffect(() => {
    fetchJSON<{ regionais: string[]; unidades: Array<{ unidade: string; regional: string }> }>('/api/acidentes/options')
      .then((d) => setOpts(d))
      .catch(() => setOpts({ regionais: [], unidades: [] }));
  }, []);

  // Carrega lista de acidentes
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (regional) params.set('regional', regional);
    if (unidade) params.set('unidade', unidade);
    if (tipo) params.set('tipo', tipo);
    if (status) params.set('status', status);
    if (empresa) params.set('empresa', empresa);
    if (ano) params.set('ano', ano);
    if (mes) params.set('mes', mes);
    if (q) params.set('q', q);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    fetchJSON<{ rows: AcidenteRow[]; total: number }>(`/api/acidentes/list?${params.toString()}`)
      .then((d) => {
        setRows(d.rows || []);
        setTotal(d.total || 0);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [regional, unidade, tipo, status, empresa, ano, mes, q, page]);

  // Carrega estatísticas
  useEffect(() => {
    if (tab !== 'visao') return;
    setStatsLoading(true);
    const params = new URLSearchParams();
    if (regional) params.set('regional', regional);
    params.set('ano', ano);

    fetchJSON<StatsData>(`/api/acidentes/stats?${params.toString()}`)
      .then((d) => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [tab, regional, ano]);

  // Carrega meta e real
  useEffect(() => {
    if (tab !== 'visao') return;
    setMetaRealLoading(true);
    const params = new URLSearchParams();
    if (regional) params.set('regional', regional);
    params.set('ano', ano);

    fetchJSON<MetaRealData>(`/api/acidentes/meta-real?${params.toString()}`)
      .then((d) => setMetaReal(d))
      .catch(() => setMetaReal(null))
      .finally(() => setMetaRealLoading(false));
  }, [tab, regional, ano]);

  const unidadesDaRegional = useMemo(() => {
    if (!regional) return opts.unidades;
    return opts.unidades.filter((u) => u.regional === regional);
  }, [opts.unidades, regional]);

  function handleOpenModal(row?: AcidenteRow) {
    if (row) {
      setEditing(row);
      setFormData({
        nome: row.nome,
        empresa: row.empresa,
        unidadeHospitalar: row.unidadeHospitalar,
        regional: row.regional || '',
        tipo: row.tipo,
        comAfastamento: row.comAfastamento,
        data: toInputDate(row.data),
        hora: row.hora || '',
        numeroCAT: row.numeroCAT || '',
        riat: row.riat || '',
        sinan: row.sinan || '',
        status: row.status,
        descricao: row.descricao || '',
      });
    } else {
      setEditing(null);
      setFormData({
        nome: '',
        empresa: 'EMSERH',
        unidadeHospitalar: '',
        regional: regional || '',
        tipo: '',
        comAfastamento: false,
        data: '',
        hora: '',
        numeroCAT: '',
        riat: '',
        sinan: '',
        status: 'aberto',
        descricao: '',
      });
    }
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formData.nome.trim()) {
      alert('Nome é obrigatório');
      return;
    }
    if (!formData.empresa) {
      alert('Empresa é obrigatória');
      return;
    }
    if (!formData.unidadeHospitalar.trim()) {
      alert('Unidade Hospitalar é obrigatória');
      return;
    }
    if (!formData.tipo) {
      alert('Tipo é obrigatório');
      return;
    }
    if (!formData.data) {
      alert('Data é obrigatória');
      return;
    }

    try {
      setSaving(true);
      const body = {
        ...(editing ? { id: editing.id } : {}),
        ...formData,
      };

      await fetchJSON('/api/acidentes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      setModalOpen(false);
      // Recarrega lista
      const params = new URLSearchParams();
      if (regional) params.set('regional', regional);
      if (unidade) params.set('unidade', unidade);
      if (tipo) params.set('tipo', tipo);
      if (status) params.set('status', status);
      if (empresa) params.set('empresa', empresa);
      if (ano) params.set('ano', ano);
      if (mes) params.set('mes', mes);
      if (q) params.set('q', q);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const d = await fetchJSON<{ rows: AcidenteRow[]; total: number }>(`/api/acidentes/list?${params.toString()}`);
      setRows(d.rows || []);
      setTotal(d.total || 0);
    } catch (e: any) {
      alert(e?.message || 'Erro ao salvar acidente');
    } finally {
      setSaving(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const totalPages = useMemo(() => {
    return total > 0 ? Math.ceil(total / pageSize) : 1;
  }, [total]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Acidentes de Trabalho</h1>
          <p className="text-xs text-muted">
            Registro, análise e acompanhamento de acidentes de trabalho nas unidades da EMSERH.
          </p>
        </div>
      </div>

      {/* Seleção de Aba */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-4 text-xs">
          <button
            type="button"
            onClick={() => setTab('registros')}
            className={`border-b-2 px-3 py-2 ${
              tab === 'registros'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Registros de Acidentes
          </button>
          <button
            type="button"
            onClick={() => setTab('visao')}
            className={`border-b-2 px-3 py-2 ${
              tab === 'visao'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Visão Geral
          </button>
        </nav>
      </div>

      {/* Filtro de Regional */}
      <div className="rounded-xl border border-border bg-panel p-4 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex flex-col gap-1">
          <span className="font-medium">Regional</span>
          <select
            className="w-52 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
            value={regional}
            onChange={(e) => {
              setRegional(e.target.value || '');
              setPage(1);
            }}
          >
            <option value="">Todas as Regionais</option>
            {REGIONALS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {tab === 'registros' && (
          <>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Unidade</span>
              <select
                className="w-64 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                value={unidade}
                onChange={(e) => {
                  setUnidade(e.target.value || '');
                  setPage(1);
                }}
              >
                <option value="">Todas as Unidades</option>
                {unidadesDaRegional.map((u) => (
                  <option key={u.unidade} value={u.unidade}>
                    {u.unidade}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Tipo</span>
              <select
                className="w-40 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value || '');
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                {TIPOS_ACIDENTE.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Status</span>
              <select
                className="w-40 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value || '');
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                {STATUS_ACIDENTE.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Empresa</span>
              <select
                className="w-32 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                value={empresa}
                onChange={(e) => {
                  setEmpresa(e.target.value || '');
                  setPage(1);
                }}
              >
                <option value="">Todas</option>
                <option value="IADVH">IADVH</option>
                <option value="EMSERH">EMSERH</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Ano</span>
              <input
                type="number"
                className="w-24 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                value={ano}
                onChange={(e) => {
                  setAno(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Mês</span>
              <select
                className="w-32 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                value={mes}
                onChange={(e) => {
                  setMes(e.target.value || '');
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                {[
                  { value: '1', label: 'Janeiro' },
                  { value: '2', label: 'Fevereiro' },
                  { value: '3', label: 'Março' },
                  { value: '4', label: 'Abril' },
                  { value: '5', label: 'Maio' },
                  { value: '6', label: 'Junho' },
                  { value: '7', label: 'Julho' },
                  { value: '8', label: 'Agosto' },
                  { value: '9', label: 'Setembro' },
                  { value: '10', label: 'Outubro' },
                  { value: '11', label: 'Novembro' },
                  { value: '12', label: 'Dezembro' },
                ].map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Buscar</span>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  className="w-48 pl-8 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Nome, unidade, CAT..."
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </>
        )}
        {tab === 'visao' && (
          <div className="flex flex-col gap-1">
            <span className="font-medium">Ano</span>
            <input
              type="number"
              className="w-24 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
              value={ano}
              onChange={(e) => setAno(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Aba: Registros */}
      {tab === 'registros' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted">
              Total: <span className="font-semibold text-text">{total}</span> acidentes
            </div>
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Plus className="w-4 h-4" />
              Novo Acidente
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full text-[11px]">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Empresa</th>
                  <th className="px-3 py-2 text-left">Unidade</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Afastamento</th>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Hora</th>
                  <th className="px-3 py-2 text-left">Mês</th>
                  <th className="px-3 py-2 text-left">CAT</th>
                  <th className="px-3 py-2 text-left">RIAT</th>
                  <th className="px-3 py-2 text-left">SINAN</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={14} className="px-3 py-6 text-center text-muted">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-3 py-6 text-center text-muted">
                      Nenhum acidente encontrado.
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((row) => {
                    const isExpanded = expandedRows.has(row.id);
                    return (
                      <React.Fragment key={row.id}>
                        <tr className="border-t border-border/60">
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => toggleExpand(row.id)}
                              className="text-muted hover:text-text"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2 align-top">{row.nome}</td>
                          <td className="px-3 py-2 align-top">{row.empresa}</td>
                          <td className="px-3 py-2 align-top">{row.unidadeHospitalar}</td>
                          <td className="px-3 py-2 align-top">
                            {TIPOS_ACIDENTE.find((t) => t.value === row.tipo)?.label || row.tipo}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {row.comAfastamento ? (
                              <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-[10px] text-red-100">
                                Com Afastamento
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] text-emerald-100">
                                Sem Afastamento
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 align-top">{formatDate(row.data)}</td>
                          <td className="px-3 py-2 align-top">{row.hora || '-'}</td>
                          <td className="px-3 py-2 align-top">
                            {[
                              'Jan',
                              'Fev',
                              'Mar',
                              'Abr',
                              'Mai',
                              'Jun',
                              'Jul',
                              'Ago',
                              'Set',
                              'Out',
                              'Nov',
                              'Dez',
                            ][row.mes - 1]}
                          </td>
                          <td className="px-3 py-2 align-top">{row.numeroCAT || '-'}</td>
                          <td className="px-3 py-2 align-top">{row.riat || '-'}</td>
                          <td className="px-3 py-2 align-top">{row.sinan || '-'}</td>
                          <td className="px-3 py-2 align-top">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] ${
                                row.status === 'concluido'
                                  ? 'bg-emerald-900/40 text-emerald-100'
                                  : row.status === 'cancelado'
                                  ? 'bg-neutral-900/40 text-neutral-100'
                                  : row.status === 'em_analise'
                                  ? 'bg-amber-900/40 text-amber-100'
                                  : 'bg-blue-900/40 text-blue-100'
                              }`}
                            >
                              {STATUS_ACIDENTE.find((s) => s.value === row.status)?.label || row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right align-top">
                            <button
                              type="button"
                              onClick={() => handleOpenModal(row)}
                              className="rounded border border-border px-2 py-1 text-[10px] hover:bg-card"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                        {isExpanded && row.descricao && (
                          <tr>
                            <td colSpan={14} className="px-3 py-3 bg-panel/50">
                              <div className="text-[11px]">
                                <div className="font-semibold mb-1">Descrição Detalhada:</div>
                                <div className="text-muted whitespace-pre-wrap">{row.descricao}</div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <div>
              Página <span className="font-semibold">{page} / {totalPages}</span>
            </div>
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                className="rounded border border-border px-2 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Anterior
              </button>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
                disabled={page >= totalPages}
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aba: Visão Geral */}
      {tab === 'visao' && (
        <div className="space-y-4">
          {/* Meta e Real */}
          {regional && (
            <div className="rounded-xl border border-border bg-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Meta vs Real - {regional}</h2>
                  <p className="text-[11px] text-muted">
                    Meta: 0 acidentes | Real: quantidade de acidentes por mês
                  </p>
                </div>
                {metaRealLoading && (
                  <span className="text-[11px] text-muted">Carregando...</span>
                )}
              </div>

              {metaReal && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-20 font-bold text-sm text-text">META</div>
                    <div className="flex-1 grid grid-cols-12 gap-1">
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((mes, idx) => (
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
                            title={`${mesesNomes[idx]}: ${quantidade} acidente(s)`}
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
                          <button
                            key={mes}
                            onClick={() => setMesSelecionado(mesSelecionado === mes ? null : mes)}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                              mesSelecionado === mes
                                ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                                : 'bg-panel border border-border text-text hover:bg-muted'
                            }`}
                            title={mesesNomes[idx]}
                          >
                            {mesesNomes[idx]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Cards de Resumo */}
          {statsLoading ? (
            <div className="text-center py-8 text-muted">Carregando estatísticas...</div>
          ) : stats ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="text-[11px] text-muted">Total no Ano</p>
                  <p className="mt-1 text-2xl font-semibold">{stats.totalAno}</p>
                </div>
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="text-[11px] text-muted">Total no Mês</p>
                  <p className="mt-1 text-2xl font-semibold">{stats.totalMes}</p>
                </div>
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="text-[11px] text-muted">Com Afastamento</p>
                  <p className="mt-1 text-2xl font-semibold text-red-200">{stats.comAfastamento}</p>
                </div>
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="text-[11px] text-muted">Sem Afastamento</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-300">{stats.semAfastamento}</p>
                </div>
              </div>

              {/* Tabelas de Estatísticas */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Por Regional */}
                <div className="rounded-xl border border-border bg-panel p-4 text-xs">
                  <h3 className="text-sm font-semibold mb-3">Por Regional</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-[11px]">
                      <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-3 py-2 text-left">Regional</th>
                          <th className="px-3 py-2 text-right">Quantidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.porRegional.map((r) => (
                          <tr key={r.regional} className="border-t border-border/60">
                            <td className="px-3 py-2">{r.regional}</td>
                            <td className="px-3 py-2 text-right">{r.quantidade}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Por Tipo */}
                <div className="rounded-xl border border-border bg-panel p-4 text-xs">
                  <h3 className="text-sm font-semibold mb-3">Por Tipo</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-[11px]">
                      <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-3 py-2 text-left">Tipo</th>
                          <th className="px-3 py-2 text-right">Quantidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.porTipo.map((t) => (
                          <tr key={t.tipo} className="border-t border-border/60">
                            <td className="px-3 py-2">
                              {TIPOS_ACIDENTE.find((tp) => tp.value === t.tipo)?.label || t.tipo}
                            </td>
                            <td className="px-3 py-2 text-right">{t.quantidade}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Por Unidade */}
                <div className="lg:col-span-2 rounded-xl border border-border bg-panel p-4 text-xs">
                  <h3 className="text-sm font-semibold mb-3">Por Unidade (Top 20)</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-[11px]">
                      <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-3 py-2 text-left">Unidade</th>
                          <th className="px-3 py-2 text-right">Quantidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.porUnidade.map((u) => (
                          <tr key={u.unidade} className="border-t border-border/60">
                            <td className="px-3 py-2">{u.unidade}</td>
                            <td className="px-3 py-2 text-right">{u.quantidade}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted">Nenhuma estatística disponível</div>
          )}
        </div>
      )}

      {/* Modal de Edição/Criação */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-panel text-xs shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-border bg-card px-4 py-3">
              <div>
                <div className="text-sm font-semibold">
                  {editing ? 'Editar Acidente' : 'Novo Acidente'}
                </div>
              </div>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-[10px] hover:bg-card"
                onClick={() => setModalOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Nome *</span>
                  <input
                    type="text"
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Empresa *</span>
                  <select
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.empresa}
                    onChange={(e) => setFormData({ ...formData, empresa: e.target.value as 'IADVH' | 'EMSERH' })}
                  >
                    <option value="IADVH">IADVH</option>
                    <option value="EMSERH">EMSERH</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <span className="font-medium">Unidade Hospitalar *</span>
                  <input
                    type="text"
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.unidadeHospitalar}
                    onChange={(e) => setFormData({ ...formData, unidadeHospitalar: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Regional</span>
                  <select
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.regional}
                    onChange={(e) => setFormData({ ...formData, regional: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {REGIONALS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Tipo *</span>
                  <select
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {TIPOS_ACIDENTE.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Afastamento</span>
                  <select
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.comAfastamento ? 'sim' : 'nao'}
                    onChange={(e) => setFormData({ ...formData, comAfastamento: e.target.value === 'sim' })}
                  >
                    <option value="nao">Sem Afastamento</option>
                    <option value="sim">Com Afastamento</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Data *</span>
                  <input
                    type="date"
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Hora</span>
                  <input
                    type="time"
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.hora}
                    onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Número da CAT</span>
                  <input
                    type="text"
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.numeroCAT}
                    onChange={(e) => setFormData({ ...formData, numeroCAT: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">RIAT</span>
                  <input
                    type="text"
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.riat}
                    onChange={(e) => setFormData({ ...formData, riat: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">SINAN</span>
                  <input
                    type="text"
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.sinan}
                    onChange={(e) => setFormData({ ...formData, sinan: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Status</span>
                  <select
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    {STATUS_ACIDENTE.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <span className="font-medium">Descrição Detalhada</span>
                  <textarea
                    className="min-h-[120px] rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Descreva detalhadamente o acidente..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  className="rounded border border-border px-3 py-2 text-[11px] hover:bg-card"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    saving
                      ? 'cursor-not-allowed bg-emerald-900/40 text-muted'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Salvar Acidente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
