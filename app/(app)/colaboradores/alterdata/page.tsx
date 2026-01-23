'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { REGIONALS, Regional, UNID_TO_REGIONAL, canonUnidade } from '@/lib/unidReg';
import { getColumnDisplayName } from '@/lib/alterdata/columnNames';
import { useAlterdata } from '@/contexts/AlterdataContext';

// ---------- Ocultação de colunas ----------
const HIDE_LABELS = [
  'Celular',
  'Cidade',
  'Data Atestado',
  'Motivo Afastamento',
  'Nome Médico',
  'Periodicidade',
  'Telefone',
  'Fim Afastamento',
  'Estado Civil',
  'Início Afastamento',
  'Mês Ultimo ASO',
  'Sexo',
  'Tipo de ASO',
  // Específicas solicitadas
  'Dtnascimento',
  'N Mes Ultimo Aso',
  'Dsmotivo',
  'Nrcelular',
  'Nrtelefone',
  'Tpestadocivil',
  'Tpsexo',
  'Nmcidade',
];

const HIDE_NORMS = new Set([
  'celular','cidade','dataatestado','motivoafastamento','nomemedico','periodicidade','telefone',
  'fimafastamento','estadocivil','inicioafastamento','mesultimoaso','sexo','tipodeaso','tipoaso',
  // Específicas solicitadas
  'dtnascimento','dt nascimento','nascimento',
  'nmesultimoaso','n mes ultimo aso','mesultimoaso',
  'dsmotivo','ds motivo','motivo',
  'nrcelular','nr celular','celular',
  'nrtelefone','nr telefone','telefone',
  'tpestadocivil','tp estado civil','estadocivil',
  'tpsexo','tp sexo','sexo',
  'nmcidade','nm cidade','cidade'
]);

function __norm(s: string){
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
}

function __shouldHide(col: string): boolean {
  const n = __norm(col);
  return HIDE_NORMS.has(n) || HIDE_LABELS.some(lbl => __norm(lbl) === n);
}

// ---------- Formatações ----------
function fmtDateDDMMYYYY(val: any): string {
  if (val === null || val === undefined) return '';
  
  // Converte para número se for string numérica
  const numVal = typeof val === 'string' ? parseFloat(val) : Number(val);
  
  // Se for um número serial do Excel (geralmente entre 1 e 100000)
  // Excel serial date: 1 = 01/01/1900
  // Fórmula: baseDate (01/01/1900) + (serial - 1) dias
  if (!isNaN(numVal) && numVal > 0 && numVal < 1000000) {
    // Data base do Excel: 1 de janeiro de 1900
    const baseDate = new Date(1900, 0, 1); // 1 de janeiro de 1900
    // Excel serial 1 = 01/01/1900, então adicionamos (serial - 1) dias
    const daysToAdd = numVal - 1;
    const jsDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    // Verifica se a data é válida e está em um range razoável (1900-2100)
    if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() >= 1900 && jsDate.getFullYear() <= 2100) {
      const day = String(jsDate.getDate()).padStart(2, '0');
      const month = String(jsDate.getMonth() + 1).padStart(2, '0');
      const year = jsDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }
  
  const s = String(val).trim();
  if (!s) return '';

  // ISO ou ISO com tempo: 2024-11-07, 2024-11-07T00:00:00
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  // dd/mm/yyyy (mantém só a data)
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;

  // yyyymmdd
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  // Pega qualquer padrão de 8+ dígitos que forme Y-M-D
  m = s.match(/(\d{4})[^\d]?(\d{2})[^\d]?(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  return s; // fallback
}

function fmtCPF(val: any): string {
  if (val === null || val === undefined) return '';
  const digits = String(val).replace(/\D/g,'') || '';
  const last11 = digits.slice(-11).padStart(11, '0');
  return `${last11.slice(0,3)}.${last11.slice(3,6)}.${last11.slice(6,9)}-${last11.slice(9)}`;
}

function fmtMatricula5(val: any): string {
  if (val === null || val === undefined) return '';
  const digits = String(val).replace(/\D/g,'') || '';
  const last5 = digits.slice(-5).padStart(5, '0');
  return last5;
}

function fmtCdChamada6(val: any): string {
  if (val === null || val === undefined) return '';
  const digits = String(val).replace(/\D/g,'') || '';
  const last6 = digits.slice(-6).padStart(6, '0');
  return last6;
}

function isDateKey(n: string): boolean {
  return n.includes('data') 
    || n.includes('admissao') 
    || n.includes('demissao') 
    || n.includes('aso') 
    || n.includes('afastamento') 
    || n.includes('nascimento')
    || n.includes('proximoaso')
    || n.includes('proximo aso')
    || n.includes('dtadmissao')
    || n.includes('dtdemissao')
    || n === 'admissao'
    || n === 'demissao';
}

function headerLabel(col: string): string {
  // Usa o mapeamento elegante de nomes de colunas
  return getColumnDisplayName(col);
}

function renderValue(col: string, val: any): string {
  const n = __norm(col);
  const colLower = col.toLowerCase();
  
  // Verifica CPF
  if (n.includes('cpf')) return fmtCPF(val);
  
  // Verifica Matrícula
  if (n.includes('matric')) return fmtMatricula5(val);
  
  // Verifica Chamada
  if (n.includes('cdchamada') || n.includes('cd chamada') || col === 'Cdchamada') return fmtCdChamada6(val);
  
  // Verifica datas - verifica tanto o nome normalizado quanto o original
  if (isDateKey(n) || 
      colLower.includes('dtadmissao') || 
      colLower.includes('dtdemissao') || 
      colLower.includes('proximo aso') || 
      colLower.includes('proximoaso') ||
      colLower === 'admissão' ||
      colLower === 'demissão' ||
      colLower === 'próximo aso') {
    return fmtDateDDMMYYYY(val);
  }
  
  return String(val ?? '');
}

// Determina o alinhamento da célula baseado no tipo de dado
function getCellAlignment(col: string): string {
  const n = __norm(col);
  const colLower = col.toLowerCase();
  
  // Regional: centralizada
  if (n === 'regional' || colLower === 'regional') {
    return 'text-center';
  }
  
  // Matrícula/Chamada: centralizada
  if (n.includes('matric') || n.includes('cdchamada') || n.includes('cd chamada') || col === 'Cdchamada') {
    return 'text-center';
  }
  
  // Desc Atestado/Tipo ASO: centralizada
  if (n.includes('descatestado') || n.includes('desc atestado') || n.includes('tipoaso') || n.includes('tipo aso')) {
    return 'text-center';
  }
  
  // Números, CPF: alinhados à direita (padrão profissional)
  if (n.includes('cpf') || n.includes('numero') || n.includes('quantidade')) {
    return 'text-right';
  }
  
  // Datas: centralizadas (mais legível e profissional)
  if (isDateKey(n) || 
      colLower.includes('dtadmissao') || 
      colLower.includes('dtdemissao') || 
      colLower.includes('proximo aso') || 
      colLower.includes('proximoaso') ||
      colLower === 'admissão' ||
      colLower === 'demissão' ||
      colLower === 'próximo aso') {
    return 'text-center';
  }
  
  // Texto: alinhado à esquerda (padrão para leitura)
  return 'text-left';
}

// ---------- Tipos ----------
type RowApi = { row_no: number; data: Record<string, string> };
type ApiRows = { ok: boolean; rows: RowApi[]; page: number; limit: number; total: number; error?: string };
type ApiCols = { ok: boolean; columns: string[]; batch_id?: string | null; error?: string };
type AnyRow = Record<string, any>;

// ---------- Aux ----------
function uniqueSorted(arr: (string|null|undefined)[]) {
  return Array.from(new Set(arr.filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b,'pt-BR'));
}

// ---- Regional detection core ----
const NAME_HINTS = [
  'unidade','unid','nmdeunidade','nm_unidade','unidade_lotacao','lotacao','estabelecimento',
  'hospital','empresa','localtrabalho','localdetrabalho','setor','departamento'
];

function detectUnidadeKeyByVoting(rows: AnyRow[], sampleSize = 200): { key: string|null, votes: Record<string, number> } {
  const votes: Record<string, number> = {};
  if (!rows?.length) return { key: null, votes };
  const keys = Object.keys(rows[0] || {});
  const top = rows.slice(0, Math.min(sampleSize, rows.length));
  for (const k of keys) {
    let v = 0;
    for (const r of top) {
      const raw = r?.[k];
      if (raw == null) continue;
      const s = String(raw);
      if (!s) continue;
      const canon = canonUnidade(s);
      if (canon && (UNID_TO_REGIONAL as any)[canon]) v++;
    }
    votes[k] = v;
  }
  const best = Object.entries(votes).sort((a,b)=>b[1]-a[1])[0];
  return { key: (best && best[1] > 0) ? best[0] : null, votes };
}

function detectUnidadeKey(rows: AnyRow[]): { key: string|null, votes: Record<string, number> } {
  const byVote = detectUnidadeKeyByVoting(rows);
  if (byVote.key) return byVote;
  if (!rows?.length) return { key: null, votes: byVote.votes };
  const keys = Object.keys(rows[0] || {});
  const scoreByName: Record<string, number> = {};
  for (const k of keys) {
    const n = __norm(k);
    let s = 0;
    for (const hint of NAME_HINTS) if (n.includes(hint)) s++;
    scoreByName[k] = s;
  }
  const best = Object.entries(scoreByName).sort((a,b)=>b[1]-a[1])[0];
  return { key: (best && best[1] > 0) ? best[0] : null, votes: byVote.votes };
}

// ---- Fetch helpers ----
async function fetchJSON(url: string, init?: RequestInit): Promise<{json:any, headers: Headers}> {
  // Usa cache reduzido: 30 segundos para garantir dados atualizados
  const r = await fetch(url, { ...init, cache: 'no-store' });
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { ok:false, error: 'JSON inválido', raw: text }; }
  return { json, headers: r.headers };
}

async function fetchPage(page: number, limit: number): Promise<{data: ApiRows, headers: Headers}> {
  const params = new URLSearchParams({ page:String(page), limit:String(limit) });
  const { json, headers } = await fetchJSON('/api/alterdata/raw-rows?' + params.toString());
  if (!json?.ok) throw new Error(json?.error || 'Falha ao carregar página '+page);
  return { data: json as ApiRows, headers };
}

export default function Page() {
  // Usa Context Global - dados já estão em cache
  const { 
    columns, 
    rows, 
    unidKey, 
    votePeek, 
    loading, 
    error, 
    progress, 
    loadData,
    clearData 
  } = useAlterdata();

  // Paginação (cliente)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const [q, setQ] = useState('');
  const [regional, setRegional] = useState<Regional | 'TODAS'>('TODAS');
  const [unidade, setUnidade] = useState<string | 'TODAS'>('TODAS');

  // Resetar página quando filtros mudarem
  useEffect(()=>{ setPage(1); }, [q, regional, unidade, pageSize]);

  // NÃO chama loadData aqui - o Context já gerencia tudo
  // Se não tiver dados, o Context vai carregar automaticamente

useEffect(() => {
  const body = bodyScrollRef.current;
  if (!body) return;
  const measure = () => {
    setScrollWidth(body.scrollWidth);
  };
  measure();
  window.addEventListener('resize', measure);
  return () => {
    window.removeEventListener('resize', measure);
  };
}, [columns, rows, pageSize]);

useEffect(() => {
  const top = topScrollRef.current;
  const body = bodyScrollRef.current;
  if (!top || !body) return;

  const onTop = () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    body.scrollLeft = top.scrollLeft;
    syncingRef.current = false;
  };

  const onBody = () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    top.scrollLeft = body.scrollLeft;
    syncingRef.current = false;
  };

  top.addEventListener('scroll', onTop);
  body.addEventListener('scroll', onBody);
  return () => {
    top.removeEventListener('scroll', onTop);
    body.removeEventListener('scroll', onBody);
  };
}, [columns, rows, pageSize]);


  const unidadeOptions = useMemo(()=>{
    const uk = unidKey;
    if (!uk) return [];
    const base = regional === 'TODAS' ? rows : rows.filter(r => r.regional === regional);
    return uniqueSorted(base.map(r => String(r[uk] ?? '')).filter(Boolean));
  }, [rows, regional, unidKey]);

  // Aplica filtros (client-side)
  const filtered = useMemo(()=>{
    const uk = unidKey;
    let list = rows;
    if (regional !== 'TODAS') list = list.filter(r => r.regional === regional);
    if (uk && unidade !== 'TODAS') list = list.filter(r => String(r[uk] ?? '') === unidade);
    if (q.trim()) {
      const needles = q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(r => {
        const blob = Object.values(r).join(' ').toLowerCase();
        return needles.every(n => blob.includes(n));
      });
    }
    return list;
  }, [rows, regional, unidade, q, unidKey]);

  // Paginação (client-side) sobre os filtrados
  const [pageState, pageData] = useMemo(()=>{
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const pageSafe = Math.min(page, pageCount);
    const start = (pageSafe - 1) * pageSize;
    const end = start + pageSize;
    const paged = filtered.slice(start, end);
    return [{ pageCount, pageSafe, start, end }, paged] as const;
  }, [filtered, page, pageSize]);
  const { pageCount, pageSafe, start, end } = pageState;
  const paged = pageData;

  return (
    <div className="space-y-4">
      
      <div className="flex flex-wrap items-center justify-between gap-2">
  <div>
    <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Alterdata • Colaboradores</p>
    <h1 className="mt-1 text-lg font-semibold">Colaboradores · Alterdata (Completa)</h1>
    <p className="mt-1 text-xs text-muted">
      Visual completo da base Alterdata com regionalização automática, filtros rápidos e paginação em memória.
    </p>
  </div>
  <div className="flex items-center gap-2">
    <button
      onClick={() => {
        try {
          // Limpa cache e recarrega dados
          clearData();
          hasLoadedRef.current = false;
          loadData();
        } catch (e) {
          alert('Erro ao limpar cache');
        }
      }}
      className="hidden md:flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-muted hover:bg-muted transition-colors"
      title="Limpar cache e recarregar dados atualizados"
    >
      🔄 Recarregar
    </button>
    <div className="hidden md:flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-muted">
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
      <span>Base carregada do Neon</span>
    </div>
  </div>
</div>

      
<div className="rounded-xl border border-border bg-panel p-4 space-y-3 text-xs">
  <div className="flex flex-col gap-2 md:flex-row md:items-center">
    <div className="flex-1">
      <input
        value={q}
        onChange={e=>setQ(e.target.value)}
        placeholder="Buscar por nome, CPF, matrícula, unidade..."
        className="w-full px-3 py-2 rounded-xl border border-border bg-bg text-sm outline-none text-text placeholder:text-muted"
      />
    </div>
    <div className="flex gap-2 md:ml-4">
      <select
        value={regional}
        onChange={e=>{ setRegional(e.target.value as any); setUnidade('TODAS'); }}
        className="px-3 py-2 rounded-xl border border-border bg-bg text-sm text-text"
      >
        <option value="TODAS">Regional (todas)</option>
        {REGIONALS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <select
        value={unidade}
        onChange={e=>setUnidade(e.target.value as any)}
        disabled={!unidKey}
        className="px-3 py-2 rounded-xl border border-border bg-bg text-sm text-text disabled:opacity-50"
      >
        <option value="TODAS">Unidade (todas)</option>
        {unidadeOptions.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  </div>

  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-xs md:text-sm">
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center rounded-full bg-panel px-2.5 py-1 text-[11px] font-medium text-muted">
        {filtered.length.toLocaleString()} registros
      </span>
      {loading && (
        <span className="text-muted">
          Carregando {progress && `(${progress})`}…
        </span>
      )}
      {error && <span className="text-red-500">Erro: {error}</span>}
    </div>

    <div className="flex flex-wrap items-center gap-3 md:justify-end">
      <div className="flex items-center gap-1 rounded-full border border-border bg-panel px-1 py-0.5">
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-text hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={pageSafe<=1}
          onClick={()=>setPage(p=>Math.max(1, p-1))}
        >
          ‹
        </button>
        <span className="px-2 text-[11px] font-medium">
          Página {pageSafe} / {pageCount}
        </span>
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-text hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={pageSafe>=pageCount}
          onClick={()=>setPage(p=>Math.min(pageCount, p+1))}
        >
          ›
        </button>
      </div>

      <select
        value={pageSize}
        onChange={e=>setPageSize(parseInt(e.target.value,10))}
        className="px-2.5 py-1.5 rounded-full border border-border bg-bg text-xs md:text-sm text-text hover:bg-panel"
      >
        {[25,50,100,200,500].map(n=> <option key={n} value={n}>{n}/página</option>)}
      </select>
    </div>
  </div>
</div>

      {columns.length > 0 && (
        <div className="rounded-xl border border-border bg-panel p-0">
          {/* Barra de rolagem horizontal no topo, sincronizada com a tabela */}
          <div
            ref={topScrollRef}
            className="overflow-x-auto max-w-full border-b border-border bg-panel/40"
          >
            <div
              style={{ width: scrollWidth || '100%' }}
              className="h-1 rounded-full bg-border"
            />
          </div>

          {/* Tabela com rolagem vertical e horizontal dentro do card */}
          <div
            ref={bodyScrollRef}
            className="max-h-[calc(100vh-280px)] overflow-y-auto overflow-x-auto"
          >
            <table className="min-w-full text-sm align-middle">
              <thead className="sticky top-0 bg-panel z-10">
                <tr>
                  {columns
                    .filter(c => !__shouldHide(c))
                    .map((c,i) => (
                    <th
                      key={i}
                      className={`px-3 py-2.5 border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm text-center`}
                    >
                      {headerLabel(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((r, idx) => (
                  <tr key={idx} className="odd:bg-panel/30 hover:bg-panel/70 transition-colors border-b border-border/50">
                    {columns
                      .filter(c => !__shouldHide(c))
                      .map((c,i) => (
                      <td key={i} className={`px-3 py-2.5 text-[11px] text-text whitespace-nowrap ${getCellAlignment(c)}`}>
                        {renderValue(c, r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-xs text-muted">
        Exibindo {start+1}–{Math.min(end, filtered.length)} de {filtered.length} registros (lista completa em cache, paginação no cliente)
      </div>
    </div>
  );
}
