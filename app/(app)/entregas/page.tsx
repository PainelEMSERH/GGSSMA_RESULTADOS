'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { isEpiObrigatorio } from '@/data/epiObrigatorio';

type Row = { id: string; nome: string; funcao: string; unidade: string; regional: string; nome_site?: string | null; };
type KitItem = { item: string; quantidade: number; nome_site?: string | null; };
type Deliver = { item: string; qty_delivered: number; qty_required: number; deliveries: Array<{date:string, qty:number}>; };

const LS_KEY = 'entregas:v2025-11-07';


type StatusCode =
  | 'ATIVO'
  | 'FERIAS'
  | 'INSS'
  | 'LICENCA_MATERNIDADE'
  | 'DEMITIDO_2025_SEM_EPI'
  | 'EXCLUIDO_META';

type StatusInfo = {
  code: StatusCode;
  label: string;
  obs?: string | null;
};

const STATUS_LABELS: Record<StatusCode, string> = {
  ATIVO: 'Ativo',
  FERIAS: 'Férias',
  INSS: 'INSS',
  LICENCA_MATERNIDADE: 'Licença maternidade',
  DEMITIDO_2025_SEM_EPI: 'Demitido 2025 sem EPI',
  EXCLUIDO_META: 'Excluído da meta',
};

const EXCLUDED_STATUS: StatusCode[] = ['DEMITIDO_2025_SEM_EPI', 'EXCLUIDO_META'];

function statusDotClass(code: StatusCode): string {
  switch (code) {
    case 'FERIAS':
      return 'bg-sky-500';
    case 'INSS':
      return 'bg-amber-500';
    case 'LICENCA_MATERNIDADE':
      return 'bg-purple-500';
    case 'DEMITIDO_2025_SEM_EPI':
      return 'bg-red-500';
    case 'EXCLUIDO_META':
      return 'bg-neutral-400';
    default:
      return 'bg-emerald-500';
  }
}

function maskCPF(cpf?: string) {
  const d = String(cpf || '').replace(/\D/g, '').padStart(11, '0').slice(-11);
  return d ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : '';
}

function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...initial, ...JSON.parse(raw) } : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [state]);
  return [state, setState] as const;
}

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export default function EntregasPage() {
  const [state, setState] = usePersistedState(LS_KEY, {
    regional: '',
    unidade: '',
    q: '',
    page: 1,
    pageSize: 25,
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidadesAll, setUnidadesAll] = useState<Array<{ unidade: string; regional: string }>>([]);


  const [statusMap, setStatusMap] = useState<Record<string, StatusInfo>>({});
  const [showExcluded, setShowExcluded] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    row?: Row | null;
    code?: StatusCode;
    obs?: string;
  }>({ open: false });

  const [tab, setTab] = useState<'lista' | 'diag'>('lista');

  const [modal, setModal] = useState<{ open: boolean; row?: Row | null }>({ open: false });
  const [kit, setKit] = useState<KitItem[]>([]);
  const [deliv, setDeliv] = useState<Deliver[]>([]);
  const [selectedEpis, setSelectedEpis] = useState<Record<string, { qtd: number; data: string }>>({});


  function setFilter(patch: Partial<typeof state>) {
    setState(prev => ({
      ...prev,
      ...patch,
      page: patch.page !== undefined && patch.page !== null ? patch.page : 1,
    }));
  }


  // Carrega / persiste status dos colaboradores no localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('entregas:status:v1');
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        setStatusMap(obj as Record<string, StatusInfo>);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('entregas:status:v1', JSON.stringify(statusMap));
    } catch {
      // ignore
    }
  }, [statusMap]);

  // ---- CADASTRO MANUAL (DECLARADO ANTES DO JSX) ----
  const [newColab, setNewColab] = useState<{ cpf: string; nome: string; funcao: string; unidade: string; regional: string; matricula?: string; admissao?: string; demissao?: string }>({ cpf: '', nome: '', funcao: '', unidade: '', regional: '' });
const [modalNew, setModalNew] = useState(false);
const [cpfCheck, setCpfCheck] = useState<{ loading: boolean; exists: boolean | null; source?: string | null }>({ loading: false, exists: null, source: null });



function openNewManual() {
  setNewColab({ cpf: '', nome: '', funcao: '', unidade: state.unidade || '', regional: state.regional || '' });
  setCpfCheck({ loading: false, exists: null, source: null });
  setModalNew(true);
}


async function checkManualCpf(cpfRaw: string) {
  const digits = String(cpfRaw || '').replace(/\D/g, '').slice(-11);
  if (!digits) {
    setCpfCheck({ loading: false, exists: null, source: null });
    return;
  }
  try {
    setCpfCheck(prev => ({ ...prev, loading: true }));
    const { json } = await fetchJSON('/api/entregas/check-cpf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: digits }),
    });
    if (json && typeof json === 'object' && 'ok' in json) {
      setCpfCheck({
        loading: false,
        exists: !!json.exists,
        source: (json.source as string | null) || null,
      });
    } else {
      setCpfCheck({ loading: false, exists: null, source: null });
    }
  } catch {
    setCpfCheck({ loading: false, exists: null, source: null });
  }
}

  async function saveNewManual() {
    const body: any = { ...newColab };
    body.cpf = String(body.cpf || '').replace(/\D/g, '').slice(-11);
    const { json } = await fetchJSON('/api/entregas/manual', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    if (json?.ok) {
      setModalNew(false);
      // reload list
      const params = new URLSearchParams();
      params.set('regional', state.regional);
      if (state.unidade) params.set('unidade', state.unidade);
      if (state.q) params.set('q', state.q);
      params.set('page', String(state.page));
      params.set('pageSize', String(state.pageSize));
      const { json: j2 } = await fetchJSON('/api/entregas/list?' + params.toString(), { cache: 'no-store' });
      setRows((j2.rows || []) as Row[]);
      setTotal(Number(j2.total || 0));
    }
  }
  // ---------------------------------------------------

  const unidades = useMemo(() => unidadesAll.filter(u => !state.regional || u.regional === state.regional), [unidadesAll, state.regional]);

  useEffect(() => {
    let on = true;
    (async () => {
      // Cache inteligente: usa cache mas com revalidação
      const { json } = await fetchJSON('/api/entregas/options', { cache: 'force-cache' });
      if (!on) return;
      setRegionais(json.regionais || []);
      setUnidadesAll(json.unidades || []);
    })();
    return () => { on = false };
  }, []);

  useEffect(() => {
    let on = true;
    (async () => {
      if (!state.regional) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('regional', state.regional);
        if (state.unidade) params.set('unidade', state.unidade);
        if (state.q) params.set('q', state.q);
        params.set('page', String(state.page));
        params.set('pageSize', String(state.pageSize));
        // Cache inteligente: usa cache quando possível, mas revalida após 30s
        const { json } = await fetchJSON('/api/entregas/list?' + params.toString(), { 
          cache: 'force-cache',
          next: { revalidate: 30 }
        });
        if (!on) return;
        setRows((json.rows || []) as Row[]);
        setTotal(Number(json.total || 0));
      } catch (e) {
        if (!on) return;
        console.error('Erro ao carregar entregas', e);
        setRows([]);
        setTotal(0);
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false };
  }, [state.regional, state.unidade, state.q, state.page, state.pageSize]);

  function openStatusModal(row: Row) {
    const current = statusMap[row.id];
    const code: StatusCode = (current?.code || 'ATIVO');
    setStatusModal({
      open: true,
      row,
      code,
      obs: current?.obs || '',
    });
  }

  function saveStatusModal() {
    if (!statusModal.row) {
      setStatusModal({ open: false });
      return;
    }
    const baseCode: StatusCode = (statusModal.code || 'ATIVO');
    const info: StatusInfo = {
      code: baseCode,
      label: STATUS_LABELS[baseCode],
      obs: statusModal.obs || '',
    };
    const cpf = statusModal.row.id;
    setStatusMap((prev) => ({
      ...prev,
      [cpf]: info,
    }));
    setStatusModal({ open: false });
  }

  
async function openDeliver(row: Row) {
    setModal({ open: true, row });
    setSelectedEpis({});

    // monta query string com função + unidade
    const params = new URLSearchParams();
    params.set('funcao', row.funcao || '');
    if (row.unidade) {
      params.set('unidade', row.unidade);
    }

    // kit esperado (considerando função + unidade hospitalar)
    const { json: kitJ } = await fetchJSON('/api/entregas/kit?' + params.toString(), { cache: 'no-store' });
    const items: KitItem[] = (kitJ?.items || kitJ?.itens || []).map((r: any) => ({
      item: r.item ?? r.epi ?? r.epi_item ?? '',
      quantidade: Number(r.quantidade ?? 1) || 1,
      nome_site: r.nome_site ?? null,
    })).filter((x: any) => x.item);
    setKit(items);

    // entregas já registradas para o CPF
    const { json: dJ } = await fetchJSON('/api/entregas/deliver?cpf=' + encodeURIComponent(row.id), { cache: 'no-store' });
    setDeliv((dJ?.rows || []).map((r: any) => ({
      item: String(r.item || ''),
      qty_delivered: Number(r.qty_delivered || 0),
      qty_required: Number(r.qty_required || 0),
      deliveries: Array.isArray(r.deliveries) ? r.deliveries : [],
    })));
  }
async function doDeliver() {
    if (!modal.row) return;
    
    // Verifica se há EPIs selecionados para entrega em massa
    const selectedItems = Object.keys(selectedEpis).filter(item => selectedEpis[item].qtd > 0);
    
    if (selectedItems.length === 0) {
      alert('Selecione pelo menos um EPI para fazer a entrega.');
      return;
    }

    // Entrega em massa
    try {
      const dataEntrega = selectedEpis[selectedItems[0]]?.data || new Date().toISOString().substring(0, 10);
      const items = selectedItems.map(item => ({
        item,
        qty: selectedEpis[item].qtd,
        date: selectedEpis[item].data || dataEntrega,
        qty_required: kit.find(k => k.item === item)?.quantidade || 1,
      }));

      const body = {
        cpf: modal.row.id,
        items,
      };

      const { ok, json } = await fetchJSON('/api/entregas/deliver', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!ok || !json?.ok) {
        console.error('Erro ao registrar entregas em massa', json);
        if (json?.error) {
          alert(`Erro ao registrar entregas: ${json.error}`);
        } else {
          alert('Erro ao registrar entregas em massa.');
        }
        return;
      }

      // Recarrega as entregas
      const { json: dJ } = await fetchJSON(
        '/api/entregas/deliver?cpf=' + encodeURIComponent(modal.row.id),
        { cache: 'no-store' },
      );

      setDeliv((dJ?.rows || []).map((r: any) => ({
        item: String(r.item || ''),
        qty_delivered: Number(r.qty_delivered || 0),
        qty_required: Number(r.qty_required || 0),
        deliveries: Array.isArray(r.deliveries) ? r.deliveries : [],
      })));

      // Limpa seleção
      setSelectedEpis({});
      
      alert(`Entregas registradas com sucesso! ${selectedItems.length} EPI(s) entregue(s).`);
    } catch (e) {
      console.error('Erro inesperado ao registrar entregas em massa', e);
      alert('Erro inesperado ao registrar entregas em massa.');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const diagResumo = useMemo(() => {
    if (!rows.length) return null;

    const counts: Record<StatusCode, number> = {
      ATIVO: 0,
      FERIAS: 0,
      INSS: 0,
      LICENCA_MATERNIDADE: 0,
      DEMITIDO_2025_SEM_EPI: 0,
      EXCLUIDO_META: 0,
    };
    const regionaisCount: Record<string, number> = {};

    for (const r of rows) {
      const st = statusMap[r.id];
      const code: StatusCode = (st?.code || 'ATIVO');
      counts[code] = (counts[code] || 0) + 1;
      const reg = (r.regional || '').trim();
      if (reg) {
        regionaisCount[reg] = (regionaisCount[reg] || 0) + 1;
      }
    }

    const foraMeta = EXCLUDED_STATUS.reduce((acc, code) => acc + (counts[code] || 0), 0);
    const total = rows.length;
    const dentroMeta = total - foraMeta;
    const regionaisLista = Object.entries(regionaisCount).sort((a, b) =>
      a[0].localeCompare(b[0], 'pt-BR'),
    );

    return {
      total,
      counts,
      foraMeta,
      dentroMeta,
      regionaisLista,
    };
  }, [rows, statusMap]);


const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      const st = statusMap[r.id];
      const code: StatusCode = (st?.code || 'ATIVO');
      if (!showExcluded && EXCLUDED_STATUS.includes(code)) return false;
      return true;
    });
  }, [rows, statusMap, showExcluded]);



  

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            EPI • Entregas
          </p>
          <h1 className="mt-1 text-lg font-semibold">Entregas de EPI</h1>
          <p className="mt-1 text-xs text-muted">
            Controle de entregas de EPI por colaborador, combinando base oficial do Alterdata e cadastros manuais.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span>Base oficial + colaboradores manuais</span>
        </div>
      </div>

      {/* Abas */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-4 text-xs">
          <button
            type="button"
            onClick={() => setTab('lista')}
            className={`border-b-2 px-3 py-2 ${
              tab === 'lista'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Lista de colaboradores
          </button>
          <button
            type="button"
            onClick={() => setTab('diag')}
            className={`border-b-2 px-3 py-2 ${
              tab === 'diag'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Diagnóstico
          </button>
        </nav>
      </div>

      {/* Aba: Lista */}
      {tab === 'lista' && (
        <>
            <div className="flex flex-col md:flex-row gap-3 items-stretch">
              <div className="flex-1">
                <label className="text-xs block mb-1">Regional</label>
                <select
                  value={state.regional}
                  onChange={e => setFilter({ regional: e.target.value, unidade: '', page: 1 })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-panel text-sm text-text placeholder:text-muted shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Selecione a Regional…</option>
                  {regionais.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs block mb-1">Unidade</label>
                <select
                  value={state.unidade}
                  onChange={e => setFilter({ unidade: e.target.value, page: 1 })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-panel text-sm text-text placeholder:text-muted shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  disabled={!state.regional}
                >
                  <option value="">(todas)</option>
                  {unidades.map(u => <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs block mb-1">Busca (nome/CPF)</label>
                <input
                  value={state.q}
                  onChange={e => setFilter({ q: e.target.value })}
                  placeholder="Digite para filtrar…"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-panel text-sm text-text placeholder:text-muted shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={openNewManual}
                className="px-3 py-2 rounded-xl bg-neutral-800 text-white dark:bg-emerald-600 self-end h-10 md:h-auto"
              >
                Cadastrar colaborador
              </button>
              <div className="w-40">
                <label className="text-xs block mb-1">Itens por página</label>
                <select
                  value={state.pageSize}
                  onChange={e => setFilter({ pageSize: Number(e.target.value) || 25, page: 1 })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-panel text-sm text-text placeholder:text-muted shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 text-xs text-neutral-700 dark:text-neutral-300 gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="opacity-70">Legenda:</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Ativo</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>Férias</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>INSS</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Licença maternidade</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Demitido 2025 sem EPI</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-neutral-400" />
                  <span>Excluído da meta</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-700">🅘</span>
                  <span>observação rápida</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-neutral-300 dark:border-neutral-700"
                    checked={showExcluded}
                    onChange={(e) => setShowExcluded(e.target.checked)}
                  />
                  <span>Mostrar colaboradores fora da meta</span>
                </label>
              </div>
            </div>

            {!state.regional && (
              <div className="p-4 rounded-xl bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                Selecione uma <strong>Regional</strong> para começar.
              </div>
            )}

            {state.regional && (
              <div className="rounded-xl border border-border bg-panel overflow-hidden">
                <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
                  <table className="min-w-full text-sm align-middle">
                    <thead className="sticky top-0 bg-panel z-10">
                      <tr>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm">
                          Nome
                        </th>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm">
                          CPF
                        </th>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm">
                          Função
                        </th>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm">
                          Unidade
                        </th>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm">
                          Regional
                        </th>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-muted">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                              <span className="text-xs">Carregando colaboradores…</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {!loading && visibleRows.map((r) => {
                        const st = statusMap[r.id];
                        const code: StatusCode = (st?.code || 'ATIVO');
                        const label = st?.label || STATUS_LABELS[code];
                        const obs = st?.obs || '';
                        const isForaMeta = EXCLUDED_STATUS.includes(code);
                        return (
                          <tr key={r.id} className="odd:bg-panel/30 hover:bg-panel/70 transition-colors border-b border-border/50">
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotClass(code)}`} />
                                <span className="truncate font-medium text-text">{r.nome}</span>
                                {(obs || code !== 'ATIVO') && (
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full border border-border cursor-default flex-shrink-0"
                                    title={obs || label}
                                  >
                                    🅘
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-text">{maskCPF(r.id)}</td>
                            <td className="px-3 py-2.5 text-text">{r.funcao || '—'}</td>
                            <td className="px-3 py-2.5 text-text">{r.unidade || '—'}</td>
                            <td className="px-3 py-2.5 text-text">{r.regional || '—'}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openStatusModal(r)}
                                  className="px-2.5 py-1.5 rounded-lg border border-border bg-panel hover:bg-muted text-xs font-medium text-text transition-colors"
                                >
                                  Situação
                                </button>
                                <button
                                  onClick={() => openDeliver(r)}
                                  disabled={isForaMeta}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    isForaMeta
                                      ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-500'
                                      : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 shadow-sm'
                                  }`}
                                >
                                  Entregar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && visibleRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-muted">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-sm">Nenhum colaborador encontrado.</span>
                              <span className="text-xs opacity-70">Ajuste os filtros ou selecione outra regional.</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-panel/50">
                  <div className="text-xs font-medium text-muted">
                    Total: <span className="text-text font-semibold">{total.toLocaleString('pt-BR')}</span> colaboradores
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 rounded-lg border"
                      disabled={state.page <= 1}
                      onClick={() => setFilter({ page: Math.max(1, state.page - 1) })}
                    >Anterior</button>
                    <span className="text-xs opacity-70">Página {state.page} de {totalPages}</span>
                    <button
                      className="px-2 py-1 rounded-lg border"
                      disabled={state.page >= totalPages}
                      onClick={() => setFilter({ page: Math.min(totalPages, state.page + 1) })}
                    >Próxima</button>
                  </div>
                </div>
              </div>
            )}

      
      
        </>
      )}

      {/* Aba: Diagnóstico */}
      {tab === 'diag' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-panel p-4 text-xs">
            {!rows.length && (
              <p className="text-muted">
                Nenhum colaborador carregado ainda. Selecione uma regional e unidade na aba de lista.
              </p>
            )}

            {rows.length > 0 && diagResumo && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-medium text-muted uppercase tracking-wide">
                      Colaboradores na lista
                    </p>
                    <p className="mt-1 text-lg font-semibold text-text">
                      {total.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-medium text-muted uppercase tracking-wide">
                      Dentro da meta
                    </p>
                    <p className="mt-1 text-lg font-semibold text-text">
                      {diagResumo.dentroMeta.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-medium text-muted uppercase tracking-wide">
                      Fora da meta
                    </p>
                    <p className="mt-1 text-lg font-semibold text-text">
                      {diagResumo.foraMeta.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-medium text-muted uppercase tracking-wide">
                      Regionais com entregas
                    </p>
                    <p className="mt-1 text-lg font-semibold text-text">
                      {diagResumo.regionaisLista.length}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-muted uppercase tracking-wide">
                      Situação dos colaboradores
                    </p>
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                      <table className="min-w-full text-xs">
                        <thead className="bg-panel">
                          <tr>
                            <th className="px-3 py-2 text-left border-b border-border">Situação</th>
                            <th className="px-3 py-2 text-right border-b border-border">Qtd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(STATUS_LABELS).map(([code, label]) => (
                            <tr key={code} className="odd:bg-panel/40">
                              <td className="px-3 py-1.5 border-b border-border">
                                {label}
                              </td>
                              <td className="px-3 py-1.5 text-right border-b border-border">
                                {diagResumo.counts[code as StatusCode]?.toLocaleString() ?? 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-muted uppercase tracking-wide">
                      Distribuição por regional
                    </p>
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                      <table className="min-w-full text-xs">
                        <thead className="bg-panel">
                          <tr>
                            <th className="px-3 py-2 text-left border-b border-border">Regional</th>
                            <th className="px-3 py-2 text-right border-b border-border">Colaboradores</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diagResumo.regionaisLista.map(([reg, count]) => (
                            <tr key={reg} className="odd:bg-panel/40">
                              <td className="px-3 py-1.5 border-b border-border">
                                {reg || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-right border-b border-border">
                                {count.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    {statusModal.open && statusModal.row && (
            <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50" onClick={() => setStatusModal({ open: false })}>
              <div
                className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-md shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="text-lg font-semibold">Situação do colaborador</div>
                  <div className="text-xs opacity-70 mt-1">
                    Ajuste a situação atual do colaborador para fins de meta e acompanhamento.
                  </div>
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <div>
                    <div className="text-xs opacity-70">Colaborador</div>
                    <div className="font-medium">
                      {statusModal.row?.nome}
                    </div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      CPF: {maskCPF(statusModal.row?.id)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs block mb-1">Situação</label>
                    <select
                      value={statusModal.code || 'ATIVO'}
                      onChange={(e) =>
                        setStatusModal((prev) => ({
                          ...prev,
                          code: e.target.value as StatusCode,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                    >
                      <option value="ATIVO">Ativo (conta na meta)</option>
                      <option value="FERIAS">Férias</option>
                      <option value="INSS">INSS</option>
                      <option value="LICENCA_MATERNIDADE">Licença maternidade</option>
                      <option value="DEMITIDO_2025_SEM_EPI">Demitido 2025 sem EPI (fora da meta)</option>
                      <option value="EXCLUIDO_META">Excluído da meta (outros motivos)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs block mb-1">Observação rápida (aparece no 🅘)</label>
                    <input
                      type="text"
                      maxLength={100}
                      value={statusModal.obs || ''}
                      onChange={(e) =>
                        setStatusModal((prev) => ({
                          ...prev,
                          obs: e.target.value,
                        }))
                      }
                      placeholder="Ex.: Férias jan/2025, INSS desde fev/2025, gestante, etc."
                      className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                    />
                    <div className="text-[10px] opacity-60 mt-1">
                      Status marcados como &quot;Demitido 2025 sem EPI&quot; ou &quot;Excluído da meta&quot; ficarão com o botão de entrega desativado e podem ser ocultados usando o filtro acima.
                    </div>
                  </div>
                </div>
                <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
                  <button
                    className="px-3 py-2 rounded-xl border"
                    onClick={() => setStatusModal({ open: false })}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-3 py-2 rounded-xl bg-neutral-800 text-white dark:bg-emerald-600"
                    onClick={saveStatusModal}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}

    {modal.open && modal.row && (
            <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setModal({ open: false })}>
              <div className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-3xl shadow-xl my-auto max-h-[90vh] overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()} style={{ isolation: 'isolate' }}>
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
                  <div className="text-lg font-semibold">Entregas de EPI — {modal.row.nome} ({maskCPF(modal.row.id)})</div>
                  <div className="text-xs opacity-70">{modal.row.funcao} • {modal.row.unidade} • {modal.row.regional}</div>
                </div>
                <div className="p-4 grid md:grid-cols-2 gap-4 overflow-y-auto flex-1 min-h-0">
                  <div>
                    <div className="font-medium text-sm mb-2">Kit esperado - Selecione os EPIs para entrega</div>
                    <div className="space-y-2 mt-2 max-h-[400px] overflow-y-auto">
                      {kit.map((k, i) => {
                        const delivered = deliv.find(d => d.item.toLowerCase() === (k.item||'').toLowerCase());
                        const obrigatorio = isEpiObrigatorio(k.item);
                        const isSelected = selectedEpis[k.item] !== undefined;
                        const selectedData = selectedEpis[k.item] || { qtd: 1, data: new Date().toISOString().substring(0, 10) };
                        
                        return (
                          <div key={i} className={`border rounded-xl p-3 ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700' : ''}`}>
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedEpis(prev => ({
                                      ...prev,
                                      [k.item]: { qtd: 1, data: new Date().toISOString().substring(0, 10) }
                                    }));
                                  } else {
                                    setSelectedEpis(prev => {
                                      const next = { ...prev };
                                      delete next[k.item];
                                      return next;
                                    });
                                  }
                                }}
                                className="mt-1 rounded border-neutral-300 dark:border-neutral-700"
                              />
                              <div className="flex-1">
                                <div className="text-sm flex items-center justify-between gap-2">
                                  <span className="font-medium">{k.item}</span>
                                  <span
                                    className={
                                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ' +
                                      (obrigatorio
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-900/60 dark:text-neutral-300')
                                    }
                                  >
                                    {obrigatorio ? 'OBRIGATÓRIO' : 'NÃO OBRIGATÓRIO'}
                                  </span>
                                </div>
                                <div className="text-xs opacity-70 mt-0.5">
                                  Requerido: {k.quantidade} • Entregue: {delivered?.qty_delivered || 0}
                                </div>
                                {isSelected && (
                                  <div className="mt-2 flex gap-2">
                                    <input
                                      type="number"
                                      min={1}
                                      value={selectedData.qtd}
                                      onChange={(e) => {
                                        const qtd = Math.max(1, Number(e.target.value) || 1);
                                        setSelectedEpis(prev => ({
                                          ...prev,
                                          [k.item]: { ...prev[k.item], qtd }
                                        }));
                                      }}
                                      className="w-20 px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                                      placeholder="Qtd"
                                    />
                                    <input
                                      type="date"
                                      value={selectedData.data}
                                      onChange={(e) => {
                                        setSelectedEpis(prev => ({
                                          ...prev,
                                          [k.item]: { ...prev[k.item], data: e.target.value }
                                        }));
                                      }}
                                      className="flex-1 px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {kit.length === 0 && <div className="text-sm opacity-70">Nenhum mapeamento de kit para esta função.</div>}
                    </div>
                    {Object.keys(selectedEpis).length > 0 && (
                      <div className="mt-3 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          {Object.keys(selectedEpis).length} EPI(s) selecionado(s) para entrega
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="overflow-hidden flex flex-col min-h-0">
                    <div className="font-medium text-sm">Registrar entrega</div>
                    <div className="flex flex-col gap-2 mt-2">
                      <button 
                        onClick={doDeliver} 
                        disabled={Object.keys(selectedEpis).length === 0}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed font-medium"
                      >
                        {Object.keys(selectedEpis).length > 0 
                          ? `Dar baixa em ${Object.keys(selectedEpis).length} EPI(s)` 
                          : 'Selecione pelo menos um EPI'}
                      </button>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        {Object.keys(selectedEpis).length > 0 
                          ? 'Clique no botão acima para entregar todos os EPIs selecionados de uma vez.'
                          : 'Selecione os EPIs na lista ao lado marcando os checkboxes para fazer a entrega.'}
                      </div>
                    </div>

                    <div className="mt-4 overflow-y-auto flex-1 min-h-0">
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-2 mb-1">
                      Somente EPIs marcados como <strong>OBRIGATÓRIO</strong> contam para a meta do SESMT.
                    </p>
                    <div className="font-medium text-sm">Entregas registradas</div>
                      <div className="grid grid-cols-1 gap-2 mt-2">
                        {deliv.map((d, i) => (
                          <div key={i} className="border rounded-xl p-2">
                            <div className="text-sm">{d.item} — {d.qty_delivered} entregue(s)</div>
                            <div className="text-xs opacity-70">Lançamentos: {Array.isArray(d.deliveries) ? d.deliveries.map((x: any) => `${x.qty} em ${x.date}`).join(', ') : ''}</div>
                          </div>
                        ))}
                        {deliv.length === 0 && <div className="text-sm opacity-70">Nenhuma entrega registrada ainda.</div>}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end flex-shrink-0">
                  <button className="px-3 py-2 rounded-xl border" onClick={() => {
                    setModal({ open: false });
                    setSelectedEpis({});
                  }}>Fechar</button>
                </div>
              </div>
            </div>
          )}

          {modalNew && (
            <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center p-4 z-50" onClick={()=>setModalNew(false)}>
              <div className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-2xl shadow-xl" onClick={e=>e.stopPropagation()}>
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="text-lg font-semibold">Cadastrar colaborador</div>
                  <div className="text-xs opacity-70">Use este cadastro quando o Alterdata ainda não refletiu a admissão.</div>
                </div>
                <div className="p-4 grid md:grid-cols-2 gap-3">
                  
<div className="md:col-span-2">
  <label className="text-xs block mb-1">CPF</label>
  <input
    value={newColab.cpf}
    onChange={e => {
      setNewColab({ ...newColab, cpf: e.target.value });
    }}
    onBlur={e => checkManualCpf(e.target.value)}
    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900"
    placeholder="000.000.000-00"
  />
  <div className="mt-1 text-[11px] min-h-[1rem]">
    {cpfCheck.loading && (
      <span className="text-neutral-500">Verificando CPF na base...</span>
    )}
    {!cpfCheck.loading && cpfCheck.exists === true && (
      <span className="text-amber-600 dark:text-amber-400">
        Este CPF já possui cadastro ({cpfCheck.source || 'base oficial/manual'}). Verifique antes de criar um novo registro.
      </span>
    )}
    {!cpfCheck.loading && cpfCheck.exists === false && (
      <span className="text-emerald-600 dark:text-emerald-400">
        CPF não encontrado na base. Pode prosseguir com o cadastro manual.
      </span>
    )}
  </div>
</div>
                  <div><label className="text-xs block mb-1">Matrícula</label><input value={newColab.matricula||''} onChange={e=>setNewColab({...newColab, matricula: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" placeholder="(opcional)" /></div>
                  <div className="md:col-span-2"><label className="text-xs block mb-1">Nome</label><input value={newColab.nome} onChange={e=>setNewColab({...newColab, nome: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" /></div>
                  <div><label className="text-xs block mb-1">Função</label><input value={newColab.funcao} onChange={e=>setNewColab({...newColab, funcao: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" placeholder="Ex.: Enfermeiro UTI" /></div>
                  <div><label className="text-xs block mb-1">Regional</label>
                    <select value={newColab.regional} onChange={e=>setNewColab({...newColab, regional: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900">
                      <option value="">Selecione…</option>
                      {regionais.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2"><label className="text-xs block mb-1">Unidade</label>
                    <select value={newColab.unidade} onChange={e=>setNewColab({...newColab, unidade: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900">
                      <option value="">Selecione…</option>
                      {unidades.map(u => <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs block mb-1">Admissão</label><input type="date" value={newColab.admissao||''} onChange={e=>setNewColab({...newColab, admissao: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" /></div>
                  <div><label className="text-xs block mb-1">Demissão</label><input type="date" value={newColab.demissao||''} onChange={e=>setNewColab({...newColab, demissao: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" /></div>
                </div>
                <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
                  <button className="px-3 py-2 rounded-xl border" onClick={()=>setModalNew(false)}>Cancelar</button>
                  <button className="px-3 py-2 rounded-xl bg-neutral-800 text-white dark:bg-emerald-600" onClick={saveNewManual}>Salvar</button>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}
