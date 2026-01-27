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

type PlanoAcaoItem = {
  descricao: string;
  responsavel: string;
  prazoSugestao: string;
};

function gerarPlanoAcao(tipo: string): PlanoAcaoItem[] {
  const t = (tipo || '').toLowerCase();

  if (t.includes('queda')) {
    return [
      {
        descricao: 'Realizar inspeção detalhada do local do acidente (piso, desníveis, corrimãos, escadas e rotas de fuga).',
        responsavel: 'Engenharia / Manutenção predial',
        prazoSugestao: '30 dias',
      },
      {
        descricao: 'Avaliar necessidade de correção de piso, nivelamento, instalação de sinalização e antiderrapantes.',
        responsavel: 'Engenharia / SESMT',
        prazoSugestao: '45 dias',
      },
      {
        descricao: 'Revisar a iluminação do ambiente e pontos críticos de circulação.',
        responsavel: 'Engenharia / Manutenção elétrica',
        prazoSugestao: '30 dias',
      },
      {
        descricao: 'Realizar treinamento de prevenção de quedas e adoção de condutas seguras no deslocamento interno.',
        responsavel: 'SESMT / Educação Corporativa',
        prazoSugestao: '60 dias',
      },
      {
        descricao: 'Revisar EPCs disponíveis (corrimãos, guarda-corpos, fitas de isolamento, sinalização de degraus).',
        responsavel: 'SESMT / Engenharia',
        prazoSugestao: '45 dias',
      },
    ];
  }

  if (t.includes('trajeto') || t.includes('transito')) {
    return [
      {
        descricao: 'Analisar o deslocamento a serviço (trajeto, tempo de percurso, meios de transporte utilizados).',
        responsavel: 'SESMT / Gestão de Pessoas',
        prazoSugestao: '30 dias',
      },
      {
        descricao: 'Verificar jornada de trabalho, intervalos e possível fadiga relacionada ao acidente.',
        responsavel: 'Gestão de Pessoas / Chefia imediata',
        prazoSugestao: '30 dias',
      },
      {
        descricao: 'Planejar e executar treinamento de direção defensiva para trabalhadores que utilizam veículo a serviço.',
        responsavel: 'SESMT / Coordenação de Frota',
        prazoSugestao: '90 dias',
      },
      {
        descricao: 'Avaliar necessidade de atualização de política interna de transporte e deslocamento a serviço.',
        responsavel: 'Diretoria / Gestão de Pessoas',
        prazoSugestao: '120 dias',
      },
    ];
  }

  if (t.includes('biologico') || t.includes('perfuro') || t.includes('cortante')) {
    return [
      {
        descricao: 'Reforçar treinamento em boas práticas de biossegurança e NR-32 para a equipe envolvida.',
        responsavel: 'SESMT / Educação Permanente',
        prazoSugestao: '60 dias',
      },
      {
        descricao: 'Revisar fluxos de descarte de materiais perfurocortantes e recipientes coletores.',
        responsavel: 'SESMT / Controle de Infecção',
        prazoSugestao: '45 dias',
      },
      {
        descricao: 'Avaliar dispositivos de segurança disponíveis (agulhas com sistema de proteção, coletores adequados).',
        responsavel: 'Engenharia Clínica / Compras',
        prazoSugestao: '60 dias',
      },
      {
        descricao: 'Monitorar situação vacinal e imunização dos trabalhadores expostos.',
        responsavel: 'Saúde Ocupacional',
        prazoSugestao: '30 dias',
      },
      {
        descricao: 'Garantir notificação em sistema oficial (ex.: SINAN) quando aplicável.',
        responsavel: 'Vigilância em Saúde / SESMT',
        prazoSugestao: 'Imediato',
      },
    ];
  }

  // Plano genérico para outros tipos
  return [
    {
      descricao: 'Realizar análise detalhada do evento com participação do SESMT, gestor local e trabalhador envolvido.',
      responsavel: 'SESMT / Chefia imediata',
      prazoSugestao: '30 dias',
    },
    {
      descricao: 'Identificar causas imediatas, causas raiz e fatores contribuintes (ambiente, processo e comportamento).',
      responsavel: 'SESMT',
      prazoSugestao: '30 dias',
    },
    {
      descricao: 'Definir e registrar ações corretivas e preventivas específicas para eliminar ou mitigar o risco.',
      responsavel: 'SESMT / Gestão / Engenharia',
      prazoSugestao: '60 dias',
    },
    {
      descricao: 'Monitorar a implementação das ações definidas, com registro de evidências e datas de conclusão.',
      responsavel: 'SESMT',
      prazoSugestao: '90 dias',
    },
  ];
}

function StatusPill({ status }: { status: 'pendente' | 'andamento' | 'concluido' }) {
  const map = {
    pendente: {
      label: 'Pendente',
      className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800',
    },
    andamento: {
      label: 'Em andamento',
      className: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:border-sky-800',
    },
    concluido: {
      label: 'Concluído',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800',
    },
  }[status];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${map.className}`}>
      {map.label}
    </span>
  );
}

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

  // Taxa de acidentes - modo manual
  const [taxaTrabalhadores, setTaxaTrabalhadores] = useState<string>('');
  const [taxaPeriodo, setTaxaPeriodo] = useState<'ano' | 'mes'>('ano');

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
  }, [regional, tipo, status, empresa, ano, mes, q, page]);

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

  const taxaManual = useMemo(() => {
    const trabalhadores = parseFloat(taxaTrabalhadores.replace(',', '.'));
    if (!stats || !trabalhadores || trabalhadores <= 0) return null;
    const acidentesBase =
      taxaPeriodo === 'mes' ? stats.totalMes || 0 : stats.totalAno || 0;
    const taxa = (acidentesBase / trabalhadores) * 1000;
    return { acidentesBase, trabalhadores, valor: taxa };
  }, [stats, taxaTrabalhadores, taxaPeriodo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            SST • Acidentes
          </p>
          <h1 className="mt-1 text-lg font-semibold">Acidentes de Trabalho</h1>
          <p className="mt-1 text-xs text-muted">
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

      {/* Filtros - card padronizado */}
      <div className="rounded-xl border border-border bg-panel p-4 shadow-sm flex flex-wrap items-center gap-3 text-xs">
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
              <span className="font-medium">Tipo</span>
              <select
                className="w-44 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
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
                className="w-44 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
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
                className="w-36 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
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
                className="w-28 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
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
                className="w-40 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="w-56 pl-8 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
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

      {/* VISÃO GERAL – blocos institucionais */}
      {tab === 'visao' && (
        <div className="space-y-4">
          {/* Bloco 1: Taxa de Acidentes */}
          <section className="rounded-xl border border-border bg-panel p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Taxa de Acidentes de Trabalho</h2>
                <p className="mt-1 text-[11px] text-muted">
                  Indicador institucional que relaciona o número de acidentes de trabalho ao efetivo
                  de trabalhadores expostos no período analisado.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <StatusPill status={taxaManual ? 'andamento' : 'pendente'} />
                <span className="text-[10px] text-muted">
                  Responsável técnico: SESMT Corporativo
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Modo 1 – Manual */}
              <div className="rounded-lg border border-border bg-bg p-3 space-y-2">
                <div className="text-xs font-semibold text-text">
                  Modo 1 — Taxa Institucional Manual
                </div>
                <p className="text-[11px] text-muted">
                  Utilizado enquanto a integração automática com as bases corporativas não estiver
                  disponível. Os dados são informados manualmente pelo serviço de Saúde e Segurança
                  do Trabalho.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-muted">
                      Número de trabalhadores
                    </span>
                    <input
                      type="number"
                      min={0}
                      className="rounded border border-border bg-card px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-emerald-500"
                      value={taxaTrabalhadores}
                      onChange={(e) => setTaxaTrabalhadores(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-muted">
                      Período de referência
                    </span>
                    <select
                      className="rounded border border-border bg-card px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-emerald-500"
                      value={taxaPeriodo}
                      onChange={(e) =>
                        setTaxaPeriodo(e.target.value === 'mes' ? 'mes' : 'ano')
                      }
                    >
                      <option value="ano">Ano atual</option>
                      <option value="mes">Mês atual</option>
                    </select>
                  </div>
                </div>

                <div className="mt-2 rounded-lg border border-dashed border-border bg-panel/70 p-3 space-y-1">
                  <p className="text-[11px] text-muted">
                    Fórmula institucional:
                    <br />
                    <span className="font-mono text-[11px] text-text">
                      Taxa de Acidentes = (Número de Acidentes / Número de Trabalhadores) × 1.000
                    </span>
                  </p>
                  <p className="text-[11px] text-muted">
                    Taxa calculada com base em dados informados manualmente, enquanto a integração
                    automática não estiver disponível.
                  </p>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-[11px] text-muted">
                    Taxa institucional calculada
                  </span>
                  <div className="text-right">
                    <div className="text-xl font-semibold text-text">
                      {taxaManual ? taxaManual.valor.toFixed(2) : '--'}‰
                    </div>
                    {taxaManual && (
                      <div className="text-[10px] text-muted">
                        {taxaManual.acidentesBase} acidente(s) / {taxaManual.trabalhadores}{' '}
                        trabalhador(es)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modo 2 – Integrado (futuro) */}
              <div className="rounded-lg border border-dashed border-border bg-bg/60 p-3 space-y-2">
                <div className="text-xs font-semibold text-text">
                  Modo 2 — Taxa Oficial Integrada (futuro)
                </div>
                <p className="text-[11px] text-muted">
                  Área reservada para integração automática com as bases oficiais da EMSERH e do
                  IADVH, contemplando número de trabalhadores, horas trabalhadas e indicadores
                  normatizados.
                </p>
                <p className="text-[11px] text-muted">
                  Este indicador será automaticamente alimentado após a conclusão das integrações
                  corporativas, garantindo rastreabilidade e confiabilidade dos dados utilizados
                  para tomada de decisão.
                </p>
              </div>
            </div>
          </section>

          {/* Bloco 2: Investigação */}
          <section className="rounded-xl border border-border bg-panel p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Investigação de Acidente de Trabalho</h2>
                <p className="mt-1 text-[11px] text-muted">
                  Estrutura padronizada para registro, análise e tratamento de acidentes de
                  trabalho, garantindo conformidade legal e rastreabilidade das informações.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <StatusPill status={total > 0 ? 'andamento' : 'pendente'} />
                <span className="text-[10px] text-muted">
                  Responsável técnico: SESMT / Núcleo de Saúde e Segurança
                </span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 text-[11px] text-muted">
              <div className="space-y-1">
                <div className="font-semibold text-text">Identificação do Acidente</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Data e hora do evento</li>
                  <li>Unidade, regional e setor de ocorrência</li>
                  <li>Função e tipo de vínculo do trabalhador</li>
                </ul>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-text">Classificação do Acidente</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Queda, acidente de trânsito, perfurocortante, biológico, ergonomia, etc.</li>
                  <li>Indicação de afastamento e gravidade</li>
                </ul>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-text">Descrição e Análise Técnica</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>O que, como, onde e por que aconteceu</li>
                  <li>Verificação de EPI, treinamento e condições inseguras</li>
                  <li>Causa imediata, causa raiz e fatores contribuintes</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              <div className="text-[11px] text-muted">
                Os documentos RIAT, CAT, SINAN e demais evidências devem ser anexados e vinculados
                diretamente ao registro do acidente.
              </div>
              <button
                type="button"
                onClick={() => handleOpenModal()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-semibold text-white hover:bg-emerald-500"
              >
                Registrar novo acidente
              </button>
            </div>
          </section>

          {/* Bloco 3: Plano de Ação */}
          <section className="rounded-xl border border-border bg-panel p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Plano de Ação Automático</h2>
                <p className="mt-1 text-[11px] text-muted">
                  A partir da classificação do acidente, o sistema sugere automaticamente um plano
                  de ação técnico e padronizado, que pode ser ajustado pelo SESMT antes da
                  conclusão.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <StatusPill status={total > 0 ? 'andamento' : 'pendente'} />
                <span className="text-[10px] text-muted">
                  Responsável técnico: SESMT / Gestão de Riscos
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted">
              Ao expandir um registro de acidente na aba <strong>Registros de Acidentes</strong>, o
              sistema exibe automaticamente um conjunto de ações sugeridas de acordo com o tipo de
              evento (queda, trajeto, perfurocortante, biológico, entre outros), incluindo
              responsáveis, prazos sugeridos e campos para registro de evidências de conclusão.
            </p>

            <p className="text-[11px] text-muted">
              Esse plano automático não substitui a avaliação técnica do SESMT, mas garante que
              nenhum aspecto essencial da investigação e das medidas preventivas deixe de ser
              considerado.
            </p>
          </section>
        </div>
      )}

      {/* Meta e Real - card principal (sempre na primeira tela) */}
      {regional && metaReal && (
        <div className="rounded-xl border border-border bg-panel p-4 shadow-sm space-y-3">
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

          <div className="flex items-center gap-2">
            <div className="w-20 font-bold text-sm text-text">META</div>
            <div className="flex-1 grid grid-cols-12 gap-1">
              {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
                (mes, idx) => (
                  <div
                    key={mes}
                    className="text-center text-xs font-medium text-text bg-muted/30 py-1.5 rounded"
                  >
                    0
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-20 font-bold text-sm text-emerald-600 dark:text-emerald-400">
              REAL
            </div>
            <div className="flex-1 grid grid-cols-12 gap-1">
              {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
                (mes, idx) => {
                  const quantidade = metaReal.real[mes] || 0;
                  const mesesNomes = [
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
                  ];
                  return (
                    <div
                      key={mes}
                      className={`text-center text-xs font-bold py-1.5 rounded ${
                        quantidade === 0 ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                      }`}
                      title={`${mesesNomes[idx]}: ${quantidade} acidente(s)`}
                    >
                      {quantidade}
                    </div>
                  );
                },
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <div className="w-20"></div>
            <div className="flex-1 grid grid-cols-12 gap-1">
              {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
                (mes, idx) => {
                  const mesesNomes = [
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
                  ];
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
                },
              )}
            </div>
          </div>
        </div>
      )}

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
                  <th className="px-3 py-2 text-center"></th>
                  <th className="px-3 py-2 text-center">Nome</th>
                  <th className="px-3 py-2 text-center">Empresa</th>
                  <th className="px-3 py-2 text-center">Unidade</th>
                  <th className="px-3 py-2 text-center">Tipo</th>
                  <th className="px-3 py-2 text-center">Afastamento</th>
                  <th className="px-3 py-2 text-center">Data</th>
                  <th className="px-3 py-2 text-center">Hora</th>
                  <th className="px-3 py-2 text-center">Mês</th>
                  <th className="px-3 py-2 text-center">CAT</th>
                  <th className="px-3 py-2 text-center">RIAT</th>
                  <th className="px-3 py-2 text-center">SINAN</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-center">Ações</th>
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
                          <td className="px-3 py-2 text-center">
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
                          <td className="px-3 py-2 text-center text-[11px]">{row.nome}</td>
                          <td className="px-3 py-2 text-center text-[11px]">{row.empresa}</td>
                          <td className="px-3 py-2 text-center text-[11px]">{row.unidadeHospitalar}</td>
                          <td className="px-3 py-2 text-center text-[11px]">
                            {TIPOS_ACIDENTE.find((t) => t.value === row.tipo)?.label || row.tipo}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.comAfastamento ? (
                              <span className="inline-flex rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-red-900/40 dark:text-red-100">
                                Com Afastamento
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-emerald-900/40 dark:text-emerald-100">
                                Sem Afastamento
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center text-[11px]">{formatDate(row.data)}</td>
                          <td className="px-3 py-2 text-center text-[11px]">{row.hora || '-'}</td>
                          <td className="px-3 py-2 text-center text-[11px]">
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
                          <td className="px-3 py-2 text-center text-[11px]">{row.numeroCAT || '-'}</td>
                          <td className="px-3 py-2 text-center text-[11px]">{row.riat || '-'}</td>
                          <td className="px-3 py-2 text-center text-[11px]">{row.sinan || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                row.status === 'concluido'
                                  ? 'bg-emerald-500 text-white dark:bg-emerald-900/40 dark:text-emerald-100'
                                  : row.status === 'cancelado'
                                  ? 'bg-neutral-600 text-white dark:bg-neutral-900/40 dark:text-neutral-100'
                                  : row.status === 'em_analise'
                                  ? 'bg-amber-500 text-white dark:bg-amber-900/40 dark:text-amber-100'
                                  : 'bg-blue-500 text-white dark:bg-blue-900/40 dark:text-blue-100'
                              }`}
                            >
                              {STATUS_ACIDENTE.find((s) => s.value === row.status)?.label || row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenModal(row)}
                              className="rounded border border-border px-2 py-1 text-[10px] hover:bg-card"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={14} className="px-3 py-3 bg-panel/50">
                              <div className="space-y-3 text-[11px]">
                                <div>
                                  <div className="font-semibold mb-1">Descrição detalhada do acidente</div>
                                  <p className="mb-2 text-muted">
                                    Descreva de forma objetiva: o que aconteceu, como aconteceu, onde ocorreu,
                                    por que ocorreu, quais atividades eram executadas, se havia EPI, se o trabalhador
                                    recebeu treinamento e se foram identificados atos ou condições inseguras.
                                  </p>
                                  <div className="whitespace-pre-wrap text-[11px] bg-bg/60 rounded-lg p-3 border border-dashed border-border">
                                    {row.descricao || 'Sem descrição detalhada informada.'}
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-border">
                                  <div className="font-semibold mb-1">Plano de Ação Automático</div>
                                  <p className="mb-2 text-muted">
                                    Ações sugeridas automaticamente com base na classificação do acidente. O SESMT pode
                                    revisar, complementar e registrar as evidências de conclusão de cada etapa.
                                  </p>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-[10px]">
                                      <thead>
                                        <tr className="text-left text-muted uppercase">
                                          <th className="py-1 pr-2">Ação recomendada</th>
                                          <th className="py-1 pr-2">Responsável</th>
                                          <th className="py-1 pr-2">Prazo sugerido</th>
                                          <th className="py-1 pr-2 text-center">Status</th>
                                          <th className="py-1 pr-2">Evidência</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {gerarPlanoAcao(row.tipo).map((acao, idxAcao) => (
                                          <tr key={idxAcao} className="border-t border-border/40">
                                            <td className="py-1 pr-2 align-top">
                                              <span className="text-xs text-text">{acao.descricao}</span>
                                            </td>
                                            <td className="py-1 pr-2 align-top">
                                              <span className="text-xs text-muted">{acao.responsavel}</span>
                                            </td>
                                            <td className="py-1 pr-2 align-top">
                                              <span className="text-xs text-muted">{acao.prazoSugestao}</span>
                                            </td>
                                            <td className="py-1 pr-2 text-center align-top">
                                              <StatusPill status="pendente" />
                                            </td>
                                            <td className="py-1 pr-2 align-top text-muted">
                                              Campo para registro das evidências de conclusão da ação.
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
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
