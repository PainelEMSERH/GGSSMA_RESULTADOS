
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { UNID_TO_REGIONAL, canonUnidade } from '@/lib/unidReg';
import { findBestUnitMatch } from '@/lib/unitMatcher';
import prisma from '@/lib/prisma';

type Row = {
  id: string;
  nome: string;
  funcao: string;
  unidade: string;
  regional: string;
  entregue?: boolean;
  kit?: string;
  kitEsperado?: string;
  kit_esperado?: string;
};

function normUp(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
}

function prettyRegional(reg: any): string {
  const n = normUp(reg);
  if (!n || n === '-' || n === '—') return '—';
  if (n === 'NORTE') return 'Norte';
  if (n === 'SUL') return 'Sul';
  if (n === 'LESTE') return 'Leste';
  if (n === 'CENTRO' || n === 'CENTRAL') return 'Central';
  return (reg ?? '').toString() || '—';
}

function normKey(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
}
function normFuncKey(s: any): string {
  const raw = (s ?? '').toString();
  const cleaned = raw.replace(/\(A\)/gi, '').replace(/\s+/g, ' ');
  return normKey(cleaned);
}
function onlyDigits(v: any): string {
  const s = String(v ?? '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 48 && c <= 57) out += s[i];
  }
  return out;
}


function esc(s: string): string {
  return (s ?? '').toString().replace(/'/g, "''");
}

function pickKeyByName(rows: any[], hints: string[]): string | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0] || {});
  let bestKey: string | null = null;
  let bestScore = -1;
  for (const k of keys) {
    const nk = normKey(k);
    let s = 0;
    for (const h of hints) if (nk.includes(h)) s++;
    if (s > bestScore) { bestScore = s; bestKey = s > 0 ? k : bestKey; }
  }
  return bestKey;
}

async function fetchRawRows(origin: string, page: number, limit: number, req: Request) {
  const u = new URL('/api/alterdata/raw-rows', origin);
  u.searchParams.set('page', String(page));
  u.searchParams.set('limit', String(limit));
  u.searchParams.set('pageSize', String(limit));
  const cookie = req.headers.get('cookie') || '';
  const auth = req.headers.get('authorization') || '';
  const r = await fetch(u.toString(), {
    cache: 'no-store',
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(auth ? { authorization: auth } : {}),
    },
  });
  if (!r.ok) throw new Error(`alterdata/raw-rows ${r.status}`);
  const data = await r.json().catch(()=>({}));
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  // Achatamento: se tem data (JSONB), espalha; senão usa o objeto direto
  const flat = rows.map((it: any) => {
    if (it.data && typeof it.data === 'object') {
      return { row_no: it.row_no, ...it.data };
    }
    return { row_no: it.row_no, ...it };
  });
  const total = Number(data?.total || flat.length);
  const lim = Number(data?.limit || limit);
  return { rows: flat, total, limit: lim };
}



type RawRowsCache = { rows: any[]; total: number; limit: number; ts: number };

let RAW_ROWS_CACHE: RawRowsCache | null = null;
let UNID_MAP_CACHE: { map: Record<string, string>; ts: number } | null = null;
let KIT_MAP_CACHE: { map: Record<string, { item: string; qtd: number }[]>; ts: number } | null = null;

const RAW_TTL_MS = 5 * 60 * 1000; // 5 minutos
const MAP_TTL_MS = 60 * 60 * 1000; // 1 hora

async function loadSafeRawRows(origin: string, req: Request): Promise<RawRowsCache> {
  const now = Date.now();
  if (RAW_ROWS_CACHE && now - RAW_ROWS_CACHE.ts < RAW_TTL_MS) {
    return RAW_ROWS_CACHE;
  }

  const limit = 1000; // mesmo limite da chamada original
  const first = await fetchRawRows(origin, 1, limit, req);
  let acc = first.rows.slice();
  const pages = Math.max(1, Math.ceil(first.total / first.limit));
  for (let p = 2; p <= pages; p++) {
    const more = await fetchRawRows(origin, p, first.limit, req);
    acc = acc.concat(more.rows);
    if (acc.length >= first.total) break;
  }

  RAW_ROWS_CACHE = { rows: acc, total: first.total, limit: first.limit, ts: now };
  return RAW_ROWS_CACHE;
}

async function loadUnidMapFromDB(): Promise<Record<string, string>> {
  const now = Date.now();
  if (UNID_MAP_CACHE && now - UNID_MAP_CACHE.ts < MAP_TTL_MS) {
    return UNID_MAP_CACHE.map;
  }
  try {
    const rs = await prisma.$queryRaw<any[]>`SELECT nmdepartamento AS unidade, regional_responsavel AS regional FROM stg_unid_reg`;
    const map: Record<string, string> = {};
    for (const r of rs) {
      const uni = String(r.unidade ?? '');
      const reg = String(r.regional ?? '');
      const canon = canonUnidade(uni);
      if (canon && reg) map[canon] = reg;
    }
    UNID_MAP_CACHE = { map, ts: now };
    return map;
  } catch {
    return UNID_MAP_CACHE?.map || {};
  }
}

async function loadKitMap(): Promise<Record<string, { item: string; qtd: number }[]>> {
  const now = Date.now();
  if (KIT_MAP_CACHE && now - KIT_MAP_CACHE.ts < MAP_TTL_MS) {
    return KIT_MAP_CACHE.map;
  }
  try {
    // Mapa de EPIs por colaborador (CPF), usando a view vw_entregas_epi_unidade,
    // que já aplica o mapeamento Função + Unidade e a regra de demissão.
    const rs = await prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(cpf::text, '')        AS cpf,
        COALESCE(epi_nome::text, '')   AS item,
        COALESCE(quantidade::numeric, 0) AS qtd
      FROM vw_entregas_epi_unidade
    `;

    const map: Record<string, { item: string; qtd: number }[]> = {};

    for (const r of rs) {
      const id = onlyDigits(r.cpf).slice(-11);
      if (!id) continue;

      const itemName = String(r.item || '').trim();
      if (!itemName) continue;

      const qtd = Number(r.qtd || 0) || 0;

      if (!map[id]) {
        map[id] = [];
      }
      const existing = map[id].find(x => x.item === itemName);
      if (!existing) {
        map[id].push({ item: itemName, qtd });
      } else if (qtd > existing.qtd) {
        existing.qtd = qtd;
      }
    }

    KIT_MAP_CACHE = { map, ts: now };
    return map;
  } catch {
    return KIT_MAP_CACHE?.map || {};
  }
}
function formatKit(items?: {item:string,qtd:number}[] | undefined): string {
  if (!items || !items.length) return '—';
  return items
    .filter(x => x.item)
    .map(x => `${x.item}${x.qtd ? ` x${x.qtd}` : ''}`)
    .join(' / ');
}


type FastListResult = { rows: Row[]; total: number };

// CPF é considerado "entregue" SOMENTE se tiver pelo menos um lançamento
// em epi_entregas (deliveries array com tamanho > 0).
const ENTREGUE_EXISTS = `EXISTS (
  SELECT 1
  FROM epi_entregas e
  WHERE regexp_replace(COALESCE(TRIM(e.cpf),''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(TRIM(a.cpf),''), '[^0-9]', '', 'g')
    AND e.deliveries IS NOT NULL
    AND jsonb_typeof(e.deliveries) = 'array'
    AND jsonb_array_length(e.deliveries) > 0
)`;

async function tryFastList(
  regional: string,
  unidade: string,
  q: string,
  page: number,
  pageSize: number,
  entregueFilter: '' | 'pendente' | 'entregue' = ''
): Promise<FastListResult | null> {
  try {
    const DEMISSAO_LIMITE = '2026-01-01'; // Colaboradores ativos em 2026 ou demitidos após 01/01/2026

    // Verifica se stg_alterdata_v2 existe
    const hasTable: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_alterdata_v2'
      ) AS exists
    `);
    
    if (!hasTable?.[0]?.exists) {
      return null; // Tabela não existe, usa fallback
    }

    // Verifica se stg_unid_reg existe
    const hasUnidReg: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `);
    const useJoin = hasUnidReg?.[0]?.exists;

    const wh: string[] = [];
    const regTrim = (regional || '').trim();
    const uniTrim = (unidade || '').trim();
    const qTrim = (q || '').trim();

    // Filtros de regional e unidade
    if (regTrim && useJoin) {
      wh.push(`(UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${esc(regTrim)}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
        SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${esc(regTrim)}'))
      ))`);
    } else if (regTrim && !useJoin) {
      // Sem JOIN, tenta mapear pela unidade usando o mapa em memória
      // Mas sem JOIN não tem como filtrar por regional, então não filtra
    }
    
    // Busca unidades do banco para fazer matching flexível
    let matchedUnidade: string | null = null;
    if (uniTrim && useJoin) {
      try {
        // Busca todas as unidades do banco para fazer matching
        const allUnits = await prisma.$queryRawUnsafe<any[]>(`
          SELECT DISTINCT 
            COALESCE(NULLIF(TRIM(u.nmdepartamento), ''), NULLIF(TRIM(a.unidade_hospitalar), ''), '') AS unidade
          FROM stg_alterdata_v2 a
          LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
          WHERE COALESCE(NULLIF(TRIM(u.nmdepartamento), ''), NULLIF(TRIM(a.unidade_hospitalar), ''), '') != ''
        `);
        const unitList = allUnits.map(u => u.unidade).filter(Boolean);
        matchedUnidade = findBestUnitMatch(uniTrim, unitList);
        if (matchedUnidade) {
          console.log(`[List API] Match de unidade: "${uniTrim}" -> "${matchedUnidade}"`);
        }
      } catch (e) {
        console.warn('[List API] Erro ao buscar unidades para matching:', e);
      }
    }
    
    if (uniTrim) {
      const unidadeParaBuscar = matchedUnidade || uniTrim;
      if (useJoin) {
        // Busca flexível: tenta exato primeiro, depois LIKE para variações
        // Inclui tanto o nome original quanto o matched
        const unidadesParaBuscar = matchedUnidade && matchedUnidade !== uniTrim 
          ? [matchedUnidade, uniTrim] 
          : [unidadeParaBuscar];
        
        const conditions = unidadesParaBuscar.map(uni => {
          const escUni = esc(uni);
          return `(
            UPPER(TRIM(COALESCE(u.nmdepartamento, ''))) = UPPER(TRIM('${escUni}'))
            OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${escUni}'))
            OR UPPER(TRIM(COALESCE(u.nmdepartamento, ''))) LIKE UPPER(TRIM('%${escUni}%'))
            OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER(TRIM('%${escUni}%'))
          )`;
        });
        
        wh.push(`(${conditions.join(' OR ')})`);
      } else {
        const unidadesParaBuscar = matchedUnidade && matchedUnidade !== uniTrim 
          ? [matchedUnidade, uniTrim] 
          : [unidadeParaBuscar];
        
        const conditions = unidadesParaBuscar.map(uni => {
          const escUni = esc(uni);
          return `(
            UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${escUni}'))
            OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER(TRIM('%${escUni}%'))
          )`;
        });
        
        wh.push(`(${conditions.join(' OR ')})`);
      }
    }

    // Filtro de busca (nome/CPF/matrícula) - via SQL para pesquisar na base inteira
    if (qTrim) {
      const escQ = esc(qTrim);
      const digits = onlyDigits(qTrim);
      const escDigits = esc(digits);
      const conds: string[] = [];
      // Nome e matrícula (texto)
      conds.push(`COALESCE(a.colaborador, '') ILIKE '%${escQ}%'`);
      conds.push(`COALESCE(a.matricula, '') ILIKE '%${escQ}%'`);
      // CPF (numérico)
      if (digits) {
        conds.push(`regexp_replace(COALESCE(TRIM(a.cpf), ''), '[^0-9]', '', 'g') LIKE '%${escDigits}%'`);
      } else {
        conds.push(`COALESCE(a.cpf, '') ILIKE '%${escQ}%'`);
      }
      wh.push(`(${conds.join(' OR ')})`);
    }

    // Só considera cadastro ATIVO: demissão em branco (não lista pessoa já demitida)
    wh.push(`(a.demissao IS NULL OR a.demissao = '' OR TRIM(a.demissao) = '')`);

    // Filtro Pendente/Entregue (epi_entregas)
    if (entregueFilter === 'pendente') {
      wh.push(`NOT ${ENTREGUE_EXISTS}`);
    } else if (entregueFilter === 'entregue') {
      wh.push(ENTREGUE_EXISTS);
    }

    const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const entregueSelect = `(${ENTREGUE_EXISTS}) AS entregue`;

    // Busca direto de stg_alterdata_v2 com JOIN em stg_unid_reg para pegar unidade e regional
    // LEFT JOIN garante que mesmo sem correspondência em stg_unid_reg, os dados aparecem
    const rowsSql = useJoin ? `
      SELECT
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.colaborador, '') AS nome,
        COALESCE(a.funcao, '') AS funcao,
        COALESCE(a.funcao, '') AS cargo,
        COALESCE(NULLIF(TRIM(u.nmdepartamento), ''), NULLIF(TRIM(a.unidade_hospitalar), ''), '') AS unidade,
        COALESCE(NULLIF(TRIM(u.regional_responsavel), ''), '') AS regional,
        COALESCE(a.demissao, '') AS demissao,
        ${entregueSelect}
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      ${whereSql}
      ORDER BY a.colaborador ASC
      LIMIT ${pageSize} OFFSET ${offset}
    ` : `
      SELECT
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.colaborador, '') AS nome,
        COALESCE(a.funcao, '') AS funcao,
        COALESCE(a.funcao, '') AS cargo,
        COALESCE(a.unidade_hospitalar, '') AS unidade,
        '' AS regional,
        COALESCE(a.demissao, '') AS demissao,
        ${entregueSelect}
      FROM stg_alterdata_v2 a
      ${whereSql}
      ORDER BY a.colaborador ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countSql = useJoin ? `
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      ${whereSql}
    ` : `
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2 a
      ${whereSql}
    `;

    let rowsRaw: any[] = [];
    let total = 0;
    
    try {
      const [rowsResult, totalResult] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(rowsSql),
        prisma.$queryRawUnsafe<any[]>(countSql),
      ]);
      
      rowsRaw = Array.isArray(rowsResult) ? rowsResult : [];
      total = Number((totalResult as any)?.[0]?.total ?? 0);
      
      console.log('[tryFastList] Resultado:', { 
        rowsCount: rowsRaw.length, 
        total, 
        useJoin,
        hasTable: hasTable?.[0]?.exists,
        hasUnidReg: hasUnidReg?.[0]?.exists,
        regional: regTrim,
        unidade: uniTrim,
        matchedUnidade,
        whereSql: whereSql.substring(0, 200)
      });
    } catch (queryError: any) {
      console.error('[tryFastList] Erro na query SQL:', queryError?.message || queryError);
      console.error('[tryFastList] SQL rows:', rowsSql.substring(0, 200));
      return null; // Retorna null para usar fallback
    }
    
    // Se não retornou dados, retorna vazio (não cai pro fallback, senão "quebra" a busca)
    if (!Array.isArray(rowsRaw) || rowsRaw.length === 0) {
      return { rows: [], total: 0 };
    }

    const unidDBMap = await loadUnidMapFromDB();

    const rows: Row[] = (rowsRaw as any[])
      .map((r: any) => {
        const idRaw = r.cpf ?? r.CPF ?? '';
        const id = onlyDigits(idRaw).slice(-11);
        const nome = String(r.nome ?? r.colaborador ?? r.NOME ?? '').trim();
        const func = String(r.funcao ?? r.cargo ?? r.FUNCAO ?? r.CARGO ?? '').trim();
        
        // Busca unidade: vem do JOIN (nmdepartamento) ou da tabela (unidade_hospitalar)
        let un = '';
        if (r.unidade && String(r.unidade).trim()) {
          un = String(r.unidade).trim();
        } else if (r.nmdepartamento && String(r.nmdepartamento).trim()) {
          un = String(r.nmdepartamento).trim();
        } else if (r.unidade_hospitalar && String(r.unidade_hospitalar).trim()) {
          un = String(r.unidade_hospitalar).trim();
        }

        // Busca regional: vem do JOIN (regional_responsavel)
        let reg = '';
        if (r.regional && String(r.regional).trim()) {
          reg = String(r.regional).trim();
        } else if (r.regional_responsavel && String(r.regional_responsavel).trim()) {
          reg = String(r.regional_responsavel).trim();
        }
        
        // Se não encontrou regional, tenta mapear pela unidade
        if (!reg && un) {
          const canon = canonUnidade(un);
          reg = (UNID_TO_REGIONAL as any)[canon] || unidDBMap[canon] || '';
        }
        
        const regOut = prettyRegional(reg);

        return {
          id,
          nome,
          funcao: func,
          unidade: un || '—',
          regional: regOut || '—',
          entregue: !!(r as any).entregue,
        } as Row;
      })
      .filter((r) => r.id || r.nome || r.unidade);

    return { rows, total };
  } catch (e) {
    console.error('entregas/fast-list error (stg_alterdata_v2)', e);
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const regional = url.searchParams.get('regional') || '';
  const unidade  = url.searchParams.get('unidade')  || '';
  const q        = url.searchParams.get('q')        || '';
  const entregue = (url.searchParams.get('entregue') || '').toLowerCase();
  const entregueFilter = (entregue === 'pendente' || entregue === 'entregue' ? entregue : '') as '' | 'pendente' | 'entregue';
  const page     = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '25', 10)));

  try {
    // Preferir sempre a lista rápida via SQL (inclusive com busca), para pesquisar na base inteira.
    const fast = await tryFastList(regional, unidade, q, page, pageSize, entregueFilter);
    if (fast && Array.isArray(fast.rows)) {
      return NextResponse.json({
        rows: fast.rows,
        total: fast.total,
        page,
        pageSize,
        source: 'stg_alterdata_v2+join',
      });
    }

    // 1) Carrega todas as páginas do raw-rows (com cache em memória)
    const mirror = await loadSafeRawRows(url.origin, req);
    let acc = mirror.rows.slice();

    // 2) Detecta chaves - prioriza nomes exatos primeiro
    const cpfKey  = pickKeyByName(acc, ['cpf','CPF','matric','matricula','Matrícula','Matricula','MATRICULA','cpffunc','cpffuncionario']);
    const nomeKey = pickKeyByName(acc, ['colaborador','Colaborador','COLABORADOR','nome','Nome','NOME','colab','funcionario']);
    const funcKey = pickKeyByName(acc, ['funcao','Função','FUNÇÃO','FUNCAO','func','cargo','Cargo','CARGO']);
    const unidKey = pickKeyByName(acc, ['unidade_hospitalar','Unidade Hospitalar','UNIDADE_HOSPITALAR','unidade','Unidade','UNIDADE','unid','lotac','lotacao','LOTACAO','setor','hosp','posto','local','nmdepartamento','NMDEPARTAMENTO','departamento','DEPARTAMENTO']);
    const regKey  = pickKeyByName(acc, ['regional','Regional','regiao','região','REGIAO','gerencia','GERENCIA','REGIONAL','regional_responsavel','REGIONAL_RESPONSAVEL']);
    const demKey  = pickKeyByName(acc, ['demissao','Demissão','DEMISSÃO','DEMISSAO','demiss','dt_demissao','demissao_colab']);

    // 3) Carrega mapa auxiliar unidade -> regional
    const unidDBMap = await loadUnidMapFromDB();

    // 4) Mapeia linhas + regional + captura demissão (sem kit aqui para manter a lista leve)
    type InternalRow = Row & { _demissao?: string };

    const DEMISSAO_LIMITE = '2026-01-01'; // Colaboradores ativos em 2026 ou demitidos após 01/01/2026

    let rowsAll: InternalRow[] = acc.map((r: any) => {
      // CPF: prioriza a chave detectada, depois tenta 'cpf' ou 'CPF'
      const idRaw = (cpfKey && (r as any)[cpfKey]) 
        ? String((r as any)[cpfKey]) 
        : String((r as any)['cpf'] ?? (r as any)['CPF'] ?? '');
      const id = onlyDigits(idRaw).slice(-11);
      
      // Nome: prioriza a chave detectada, depois tenta 'colaborador' ou 'Colaborador'
      const nome = (nomeKey && (r as any)[nomeKey]) 
        ? String((r as any)[nomeKey]).trim()
        : String((r as any)['colaborador'] ?? (r as any)['Colaborador'] ?? (r as any)['nome'] ?? (r as any)['Nome'] ?? '').trim();
      
      // Função: prioriza a chave detectada, depois tenta 'funcao' ou 'Função'
      const func = (funcKey && (r as any)[funcKey]) 
        ? String((r as any)[funcKey]).trim()
        : String((r as any)['funcao'] ?? (r as any)['Função'] ?? (r as any)['cargo'] ?? (r as any)['Cargo'] ?? '').trim();
      // Busca unidade: prioriza unidade_hospitalar (coluna do stg_alterdata_v2)
      let un = '';
      if (unidKey && (r as any)[unidKey]) {
        un = String((r as any)[unidKey]).trim();
      } else {
        // Tenta unidade_hospitalar primeiro (coluna real em stg_alterdata_v2)
        const unidHints = ['unidade_hospitalar', 'Unidade Hospitalar', 'UNIDADE_HOSPITALAR',
                           'unidade', 'Unidade', 'UNIDADE', 'unid', 'lotacao', 'LOTACAO', 'lotac', 
                           'setor', 'SETOR', 'hosp', 'posto', 'local', 
                           'nmdepartamento', 'NMDEPARTAMENTO', 'departamento', 'DEPARTAMENTO'];
        for (const hint of unidHints) {
          if ((r as any)[hint] && String((r as any)[hint]).trim()) {
            un = String((r as any)[hint]).trim();
            break;
          }
        }
      }
      
      const demRaw = demKey ? String(((r as any)[demKey] ?? '') as any) : '';
      
      // Regional: primeiro tenta buscar direto, depois mapeia pela unidade
      let reg = '';
      if (regKey && (r as any)[regKey]) {
        reg = String((r as any)[regKey]).trim();
      } else {
        // Tenta outras chaves comuns (mas geralmente não vem direto do Alterdata)
        const regHints = ['regional', 'Regional', 'REGIONAL', 'regiao', 'REGIAO', 'região', 
                          'gerencia', 'GERENCIA', 'regional_responsavel', 'REGIONAL_RESPONSAVEL'];
        for (const hint of regHints) {
          if ((r as any)[hint] && String((r as any)[hint]).trim()) {
            reg = String((r as any)[hint]).trim();
            break;
          }
        }
      }
      
      // Se não encontrou regional, tenta mapear pela unidade
      if (!reg && un) {
        const canon = canonUnidade(un);
        reg = (UNID_TO_REGIONAL as any)[canon] || unidDBMap[canon] || '';
      }
      
      const regOut = prettyRegional(reg);
      
      return {
        id,
        nome,
        funcao: func,
        unidade: un || '—',
        regional: regOut || '—',
        _demissao: demRaw,
      };
    }).filter(x => x.id || x.nome || x.unidade);

    // 5) Aplica regra de demissão:
    // - demissão vazia -> fica
    // - demissão em 2026 ou depois -> fica
    // - demissão antes de 2026 -> sai
    function keepByDemissao(r: InternalRow): boolean {
      const raw = (r._demissao || '').trim();
      if (!raw) return true;
      // Excel serial date (número)
      if (/^\d+$/.test(raw)) {
        const excelSerial = parseInt(raw, 10);
        // 1899-12-30 + N dias
        const dt = new Date(Date.UTC(1899, 11, 30));
        dt.setUTCDate(dt.getUTCDate() + excelSerial);
        return dt.getUTCFullYear() >= 2026;
      }

      // YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const year = parseInt(raw.slice(0, 4), 10);
        return year >= 2026;
      }

      // DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
        const year = parseInt(raw.slice(6, 10), 10);
        return year >= 2026;
      }

      // formato desconhecido: não exclui por segurança
      return true;
    }

    let rows: Row[] = rowsAll.filter(keepByDemissao).map(({ _demissao, ...rest }) => rest);

    // 6) Filtros (regional precisa ser exata, mas compara com prettyRegional)
    const nreg = regional.trim();
    const nuni = unidade.trim();
    const nq   = normUp(q);
    
    // Busca unidades para matching flexível no fallback também
    let matchedUnidadeFallback: string | null = null;
    if (nuni) {
      try {
        const allUnits = rows.map(r => r.unidade).filter(Boolean);
        matchedUnidadeFallback = findBestUnitMatch(nuni, allUnits);
        if (matchedUnidadeFallback) {
          console.log(`[List API Fallback] Match de unidade: "${nuni}" -> "${matchedUnidadeFallback}"`);
        }
      } catch (e) {
        console.warn('[List API Fallback] Erro ao fazer matching de unidade:', e);
      }
    }
    
    if (nreg) {
      rows = rows.filter(r => {
        // Compara diretamente com a regional formatada (Norte, Sul, etc.)
        return r.regional === nreg || normUp(r.regional) === normUp(nreg);
      });
    }
    
    // Filtro de unidade com matching flexível
    if (nuni) {
      if (matchedUnidadeFallback) {
        // Usa a unidade encontrada pelo matching
        rows = rows.filter(r => {
          const rUniNorm = normUp(r.unidade);
          const matchedNorm = normUp(matchedUnidadeFallback!);
          return rUniNorm === matchedNorm || rUniNorm.includes(matchedNorm) || matchedNorm.includes(rUniNorm);
        });
      } else {
        // Fallback: busca por similaridade
        rows = rows.filter(r => {
          const rUniNorm = normUp(r.unidade);
          const nuniNorm = normUp(nuni);
          return rUniNorm === nuniNorm || rUniNorm.includes(nuniNorm) || nuniNorm.includes(rUniNorm);
        });
      }
    }
    
    if (nq)   rows = rows.filter(r => normUp(r.nome).includes(nq) || normUp(r.id).includes(nq));

    // 6b) Filtro Pendente/Entregue (epi_entregas) e flag entregue por linha
    // Considera entregue apenas quem tem AO MENOS UM lançamento registrado
    let cpfsEntregues = new Set<string>();
    try {
      const ent: any[] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT regexp_replace(COALESCE(TRIM(cpf),''), '[^0-9]', '', 'g') AS cpf
        FROM epi_entregas
        WHERE regexp_replace(COALESCE(TRIM(cpf),''), '[^0-9]', '', 'g') != ''
          AND deliveries IS NOT NULL
          AND jsonb_typeof(deliveries) = 'array'
          AND jsonb_array_length(deliveries) > 0
      `);
      for (const x of ent) {
        const c = String(x?.cpf ?? '').replace(/\D/g, '').slice(-11);
        if (c) cpfsEntregues.add(c);
      }
    } catch (_) {}
    if (entregueFilter === 'pendente') {
      rows = rows.filter(r => !cpfsEntregues.has(r.id));
    } else if (entregueFilter === 'entregue') {
      rows = rows.filter(r => cpfsEntregues.has(r.id));
    }
    rows = rows.map(r => ({ ...r, entregue: cpfsEntregues.has(r.id) }));

    // 7) Pagina
    rows.sort((a,b)=> a.nome.localeCompare(b.nome));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    return NextResponse.json({ rows: pageRows, total, page, pageSize, source: 'safe_mirror_auth+regional+kit+DEMISS' });
  } catch (e:any) {
    return NextResponse.json({ rows: [], total: 0, page, pageSize, source: 'error', error: e?.message || String(e) }, { status: 200 });
  }
}
