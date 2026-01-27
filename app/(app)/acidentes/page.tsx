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
  setor?: string | null;
  funcaoTrabalhador?: string | null;
  tipoVinculo?: string | null;
  causaImediata?: string | null;
  causaRaiz?: string | null;
  fatoresContrib?: string | null;
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
  { value: 'biologico', label: 'Exposição a material biológico / Perfurocortante' },
  { value: 'trajeto', label: 'Acidente de Trânsito / Trajeto' },
  { value: 'tipico', label: 'Acidente Típico' },
  { value: 'de_trabalho', label: 'Acidente de Trabalho' },
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
    setor: '',
    funcaoTrabalhador: '',
    tipoVinculo: '',
    causaImediata: '',
    causaRaiz: '',
    fatoresContrib: '',
  });
  const [saving, setSaving] = useState(false);

  // Detalhes expandidos
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Visão Geral
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Taxa de Frequência (TF) - edição anual (12 meses)
  const [tfAno, setTfAno] = useState<string>(String(new Date().getFullYear()));
  const [tfMeses, setTfMeses] = useState<
    Record<
      string,
      {
        accidentes: string;
        horas: string;
        tf: string;
      }
    >
  >(() => {
    const base: any = {};
    ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].forEach((m) => {
      base[m] = { accidentes: '', horas: '', tf: '--' };
    });
    return base;
  });

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('ano', tfAno);
    fetchJSON<{ registros: any[] }>('/api/acidentes/taxa-frequencia?' + params.toString())
      .then((d) => {
        const base: any = {};
        ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].forEach((m) => {
          base[m] = { accidentes: '', horas: '', tf: '--' };
        });
        (d.registros || []).forEach((r: any) => {
          const mes = String(r.mes).padStart(2, '0');
          const acidentes = String(r.numeroAcidentes ?? '');
          const horas =
            r.horasHomemTrabalhadas != null
              ? String(r.horasHomemTrabalhadas)
              : '';
          const tf =
            r.taxaFrequencia != null
              ? Number(r.taxaFrequencia).toFixed(2)
              : '--';
          base[mes] = { accidentes: acidentes, horas, tf };
        });
        setTfMeses(base);
      })
      .catch(() => {
        const base: any = {};
        ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].forEach((m) => {
          base[m] = { accidentes: '', horas: '', tf: '--' };
        });
        setTfMeses(base);
      });
  }, [tfAno]);

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
    setStatsLoading(true);
    const params = new URLSearchParams();
    if (regional) params.set('regional', regional);
    params.set('ano', ano);

    fetchJSON<StatsData>(`/api/acidentes/stats?${params.toString()}`)
      .then((d) => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [regional, ano]);

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
        setor: row.setor || '',
        funcaoTrabalhador: row.funcaoTrabalhador || '',
        tipoVinculo: row.tipoVinculo || '',
        causaImediata: row.causaImediata || '',
        causaRaiz: row.causaRaiz || '',
        fatoresContrib: row.fatoresContrib || '',
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
        setor: '',
        funcaoTrabalhador: '',
        tipoVinculo: '',
        causaImediata: '',
        causaRaiz: '',
        fatoresContrib: '',
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
      </div>

      {/* VISÃO GERAL – blocos institucionais */}
      <div className="space-y-4">
        {/* Bloco 1: Taxa de Frequência (TF) */}
          <section className="rounded-xl border border-border bg-panel p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Taxa de Frequência de Acidentes de Trabalho (TF)</h2>
                <p className="mt-1 text-[11px] text-muted">
                  Indicador calculado mensalmente com base no número de acidentes de trabalho e no
                  total de horas-homem trabalhadas, permitindo o monitoramento da frequência de
                  acidentes ao longo do tempo.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted">
                  Ano de referência
                </span>
                <input
                  type="number"
                  className="w-28 rounded border border-border bg-card px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-emerald-500"
                  value={tfAno}
                  onChange={(e) => setTfAno(e.target.value)}
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-bg/60 p-2 overflow-x-auto">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted">Mês</span>
                  <div className="grid grid-cols-12 gap-1 flex-1 ml-4">
                    {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((nome) => (
                      <div
                        key={nome}
                        className="text-center text-[10px] font-semibold text-muted"
                      >
                        {nome}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-40 text-[11px] font-medium text-muted">
                      Nº de Acidentes *
                    </span>
                    <div className="grid grid-cols-12 gap-1 flex-1">
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
                        (m) => {
                          const linha = tfMeses[m];
                          return (
                            <input
                              key={m}
                              type="number"
                              min={0}
                              className="w-full rounded border border-border bg-card px-1 py-1 text-[11px] text-right outline-none focus:ring-1 focus:ring-emerald-500"
                              value={linha?.accidentes ?? ''}
                              onChange={(e) => {
                                const accidentes = e.target.value;
                                const horas = linha?.horas ?? '';
                                let tf = '--';
                                const aNum = parseInt(accidentes || '0', 10);
                                const hNum = parseFloat((horas || '0').replace(',', '.'));
                                if (!Number.isNaN(aNum) && !Number.isNaN(hNum) && hNum > 0) {
                                  tf = ((aNum * 1_000_000) / hNum).toFixed(2);
                                }
                                setTfMeses((prev) => ({
                                  ...prev,
                                  [m]: { accidentes, horas, tf },
                                }));
                              }}
                            />
                          );
                        },
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-40 text-[11px] font-medium text-muted">
                      Horas-Homem (h) *
                    </span>
                    <div className="grid grid-cols-12 gap-1 flex-1">
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
                        (m) => {
                          const linha = tfMeses[m];
                          return (
                            <input
                              key={m}
                              type="number"
                              min={0}
                              step="0.01"
                              className="w-full rounded border border-border bg-card px-1 py-1 text-[11px] text-right outline-none focus:ring-1 focus:ring-emerald-500"
                              value={linha?.horas ?? ''}
                              onChange={(e) => {
                                const horas = e.target.value;
                                const accidentes = linha?.accidentes ?? '';
                                let tf = '--';
                                const aNum = parseInt(accidentes || '0', 10);
                                const hNum = parseFloat((horas || '0').replace(',', '.'));
                                if (!Number.isNaN(aNum) && !Number.isNaN(hNum) && hNum > 0) {
                                  tf = ((aNum * 1_000_000) / hNum).toFixed(2);
                                }
                                setTfMeses((prev) => ({
                                  ...prev,
                                  [m]: { accidentes, horas, tf },
                                }));
                              }}
                            />
                          );
                        },
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-40 text-[11px] font-medium text-muted">
                      TF (por milhão de horas)
                    </span>
                    <div className="grid grid-cols-12 gap-1 flex-1">
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
                        (m) => {
                          const linha = tfMeses[m];
                          return (
                            <div
                              key={m}
                              className="w-full rounded border border-border bg-panel/70 px-1 py-1 text-[11px] text-center"
                            >
                              {linha?.tf ?? '--'}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 rounded-lg border border-dashed border-border bg-panel/70 p-3 space-y-1">
              <p className="text-[11px] text-muted">
                Fórmula oficial da Taxa de Frequência (TF):
                <br />
                <span className="font-mono text-[11px] text-text">
                  TF = (Número de Acidentes de Trabalho × 1.000.000) / Total de Horas-Homem
                  Trabalhadas
                </span>
              </p>
              <p className="text-[11px] text-muted">
                O fator <span className="font-mono">1.000.000</span> é fixo e não editável. O
                cálculo é realizado automaticamente após o preenchimento dos dados obrigatórios.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
              <p className="text-[11px] text-muted">
                As taxas mensais de frequência serão armazenadas para fins de histórico anual e
                comparação entre períodos.
              </p>
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
                onClick={async () => {
                  try {
                    const anoNum = parseInt(tfAno || String(new Date().getFullYear()), 10);
                    const meses = ['01','02','03','04','05','06','07','08','09','10','11','12'];
                    for (const m of meses) {
                      const linha = tfMeses[m];
                      if (!linha) continue;
                      const acidentes = parseInt(linha.accidentes || '0', 10);
                      const horas = parseFloat((linha.horas || '0').replace(',', '.'));
                      if (Number.isNaN(acidentes) || Number.isNaN(horas) || horas <= 0) {
                        continue;
                      }
                      await fetchJSON('/api/acidentes/taxa-frequencia', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          ano: anoNum,
                          mes: parseInt(m, 10),
                          numeroAcidentes: acidentes,
                          horasHomemTrabalhadas: horas,
                        }),
                      });
                    }
                    alert('Taxas de Frequência do ano salvas com sucesso.');
                  } catch (e: any) {
                    alert(e?.message || 'Erro ao salvar Taxas de Frequência');
                  }
                }}
              >
                Salvar taxas do ano
              </button>
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

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => handleOpenModal()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-semibold text-white hover:bg-emerald-500"
              >
                Registrar novo acidente
              </button>
            </div>
          </section>

        {/* Bloco 3 removido: explicação textual do Plano de Ação Automático */}
      </div>

      {/* Registros de Acidentes */}
      <div className="space-y-4">
        <div className="text-xs text-muted">
          Total: <span className="font-semibold text-text">{total}</span> acidentes
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
                                <div className="grid gap-3 md:grid-cols-3">
                                  <div className="space-y-1">
                                    <div className="font-semibold mb-1">Identificação do acidente</div>
                                    <p className="text-muted">
                                      <span className="font-medium text-text">Data/Hora: </span>
                                      {formatDate(row.data)} {row.hora || ''}
                                    </p>
                                    <p className="text-muted">
                                      <span className="font-medium text-text">Unidade: </span>
                                      {row.unidadeHospitalar}
                                    </p>
                                    <p className="text-muted">
                                      <span className="font-medium text-text">Regional: </span>
                                      {row.regional || 'Não informada'}
                                    </p>
                                    {row.setor && (
                                      <p className="text-muted">
                                        <span className="font-medium text-text">Setor: </span>
                                        {row.setor}
                                      </p>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <div className="font-semibold mb-1">Perfil do trabalhador</div>
                                    <p className="text-muted">
                                      <span className="font-medium text-text">Nome: </span>
                                      {row.nome}
                                    </p>
                                    {row.funcaoTrabalhador && (
                                      <p className="text-muted">
                                        <span className="font-medium text-text">Função: </span>
                                        {row.funcaoTrabalhador}
                                      </p>
                                    )}
                                    {row.tipoVinculo && (
                                      <p className="text-muted">
                                        <span className="font-medium text-text">Tipo de vínculo: </span>
                                        {row.tipoVinculo}
                                      </p>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <div className="font-semibold mb-1">Análise técnica</div>
                                    {row.causaImediata && (
                                      <p className="text-muted">
                                        <span className="font-medium text-text">Causa imediata: </span>
                                        {row.causaImediata}
                                      </p>
                                    )}
                                    {row.causaRaiz && (
                                      <p className="text-muted">
                                        <span className="font-medium text-text">Causa raiz: </span>
                                        {row.causaRaiz}
                                      </p>
                                    )}
                                    {row.fatoresContrib && (
                                      <p className="text-muted">
                                        <span className="font-medium text-text">Fatores contribuintes: </span>
                                        {row.fatoresContrib}
                                      </p>
                                    )}
                                  </div>
                                </div>

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
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="font-semibold">Plano de Ação Automático</div>
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-semibold hover:bg-card"
                                      onClick={() => {
                                        // A geração é automática com base no tipo; este botão existe para tornar
                                        // a regra explícita para o usuário.
                                        alert(
                                          'O plano de ação foi gerado automaticamente com base na classificação do acidente e pode ser ajustado pelo SESMT.',
                                        );
                                      }}
                                    >
                                      Gerar Plano de Ação
                                    </button>
                                  </div>
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

      {/* Visão Geral - Estatísticas */}
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
                  <span className="font-medium">Setor</span>
                  <input
                    type="text"
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.setor}
                    onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Função do trabalhador</span>
                  <input
                    type="text"
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.funcaoTrabalhador}
                    onChange={(e) =>
                      setFormData({ ...formData, funcaoTrabalhador: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Tipo de vínculo</span>
                  <input
                    type="text"
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.tipoVinculo}
                    onChange={(e) => setFormData({ ...formData, tipoVinculo: e.target.value })}
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
                  <span className="font-medium">Descrição Detalhada *</span>
                  <p className="text-[11px] text-muted">
                    Responda de forma objetiva: o que aconteceu? como aconteceu? onde aconteceu? por
                    que aconteceu? havia EPI? havia treinamento? houve condição insegura ou ato
                    inseguro?
                  </p>
                  <textarea
                    className="min-h-[120px] rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Descreva detalhadamente o acidente, contemplando o que, como, onde, por que, uso de EPI, treinamento e condições/atos inseguros."
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <span className="font-medium">Análise Técnica — Causa imediata</span>
                  <textarea
                    className="min-h-[80px] rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.causaImediata}
                    onChange={(e) => setFormData({ ...formData, causaImediata: e.target.value })}
                    placeholder="Descreva os eventos e condições que levaram diretamente ao acidente (causa imediata)."
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <span className="font-medium">Análise Técnica — Causa raiz</span>
                  <textarea
                    className="min-h-[80px] rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.causaRaiz}
                    onChange={(e) => setFormData({ ...formData, causaRaiz: e.target.value })}
                    placeholder="Descreva as causas básicas ou sistêmicas que permitiram a ocorrência do acidente (causa raiz)."
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <span className="font-medium">
                    Fatores contribuintes (ambiente, processo, comportamento)
                  </span>
                  <textarea
                    className="min-h-[80px] rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.fatoresContrib}
                    onChange={(e) => setFormData({ ...formData, fatoresContrib: e.target.value })}
                    placeholder="Registre fatores contribuintes relacionados a ambiente, processo de trabalho e comportamento."
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
