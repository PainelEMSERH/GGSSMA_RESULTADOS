export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';
import { randomUUID } from 'crypto';

const ROOT_ADMIN_EMAIL = 'jonathan.alves@emserh.ma.gov.br';

async function requireRootAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error('UNAUTHENTICATED');

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';
  if (email !== ROOT_ADMIN_EMAIL) throw new Error('FORBIDDEN');

  return { userId, email };
}

function normHeader(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function pickHeader(headers: string[], predicate: (hNorm: string, raw: string) => boolean): string | null {
  const match = headers.find((h) => predicate(normHeader(h), h));
  return match ?? null;
}

function toNumberMaybe(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;

  // Permite 1.234,56 ou 1234,56 ou 1234.56 etc.
  const cleaned = s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function escSqlText(s: string): string {
  return s.replace(/'/g, "''");
}

type ImportRow = {
  alterdata_funcao: string;
  funcao_normalizada: string;
  epi_item: string;
  quantidade: number;
  pcg: string;
  unidade_hospitalar: string;
};

const REQUIRED_COLUMNS = ['alterdata_funcao', 'funcao_normalizada', 'epi_item', 'quantidade', 'pcg', 'unidade_hospitalar'];

async function assertColumnsExist(tableName: string) {
  const cols: any[] = await prisma.$queryRawUnsafe(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    tableName,
  );

  const existing = new Set((cols || []).map((c) => String(c.column_name)));
  const missing = REQUIRED_COLUMNS.filter((c) => !existing.has(c));
  if (missing.length) {
    throw new Error(`A tabela "${tableName}" não possui as colunas exigidas: ${missing.join(', ')}`);
  }
}

export async function POST(req: Request) {
  try {
    await requireRootAdmin();

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: 'Envie um arquivo .xlsx (ou CSV) com o mapa de EPI' }, { status: 400 });
    }

    const filename = (file.name || '').toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    const isXlsx = filename.endsWith('.xlsx') || filename.endsWith('.xls');
    if (!isXlsx && !filename.endsWith('.csv')) {
      return NextResponse.json({ ok: false, error: 'Formato inválido. Envie .xlsx ou .csv' }, { status: 400 });
    }

    let rawRows: Record<string, unknown>[] = [];
    let headers: string[] = [];

    if (isXlsx) {
      const xlsx = await import('xlsx');
      const wb = xlsx.read(buf, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
      headers = Array.from(new Set(rawRows.flatMap((r) => Object.keys(r || {})).map((h) => String(h).trim())));
    } else {
      // CSV (simples) - tenta detectar separador
      const text = buf.toString('utf8');
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        return NextResponse.json({ ok: false, error: 'Arquivo vazio ou sem linhas' }, { status: 400 });
      }

      const first = lines[0];
      const sep = first.includes(';') && !first.includes(',') ? ';' : ',';

      const splitLine = (line: string) => {
        const out: string[] = [];
        let cur = '';
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQ && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQ = !inQ;
            }
          } else if (ch === sep && !inQ) {
            out.push(cur);
            cur = '';
          } else {
            cur += ch;
          }
        }
        out.push(cur);
        return out.map((x) => x.trim());
      };

      headers = splitLine(lines[0]);

      rawRows = lines.slice(1).map((line) => {
        const cells = splitLine(line);
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          obj[h] = (cells[i] ?? '').trim();
        });
        return obj;
      });
    }

    if (!rawRows.length) {
      return NextResponse.json({ ok: false, error: 'Arquivo sem dados' }, { status: 400 });
    }

    if (!headers.length) {
      headers = Array.from(new Set(rawRows.flatMap((r) => Object.keys(r || {}))));
    }

    // Esperamos (nomes podem variar): função (alterdata), normalizada (opcional),
    // setor (unidade_hospitalar), kit (epi_item), pcg (pgr) e qtd (quantidade).
    const funcaoAlterdataKey =
      pickHeader(headers, (hNorm) => hNorm.includes('ALTERDATA') && hNorm.includes('FUN')) ||
      pickHeader(headers, (hNorm) => hNorm.includes('FUNCAO') && !hNorm.includes('NORMAL')) ||
      pickHeader(headers, (hNorm) => hNorm === 'FUNCAO' || hNorm === 'FUNCAOENFERMEIRO') ||
      null;

    const funcaoNormalizadaKey =
      pickHeader(headers, (hNorm) => (hNorm.includes('NORMAL') || hNorm.includes('NORM')) && hNorm.includes('FUN')) || null;

    const setorKey =
      pickHeader(headers, (hNorm) => hNorm.includes('SETOR')) ||
      pickHeader(headers, (hNorm) => (hNorm.includes('UNIDADE') || hNorm.includes('DEPARTAMENTO')) && !hNorm.includes('REGIONAL')) ||
      null;

    const kitKey = pickHeader(headers, (hNorm) => hNorm.includes('KIT')) || pickHeader(headers, (hNorm) => hNorm.includes('EPI')) || null;

    const pcgKey = pickHeader(headers, (hNorm) => hNorm.includes('PCG') || hNorm.includes('PGR')) || null;

    const qtdKey =
      pickHeader(headers, (hNorm) => hNorm.includes('QTD') || hNorm.includes('QUANTIDADE') || hNorm.includes('QTD')) || null;

    if (!funcaoAlterdataKey) {
      return NextResponse.json(
        { ok: false, error: 'Não encontrei a coluna de FUNÇÃO (ALTERDATA) no Excel. Verifique o cabeçalho.' },
        { status: 400 },
      );
    }
    if (!setorKey) {
      return NextResponse.json(
        { ok: false, error: 'Não encontrei a coluna de SETOR (unidade_hospitalar) no Excel. Verifique o cabeçalho.' },
        { status: 400 },
      );
    }
    if (!kitKey) {
      return NextResponse.json(
        { ok: false, error: 'Não encontrei a coluna de KIT/EPI no Excel. Verifique o cabeçalho.' },
        { status: 400 },
      );
    }
    if (!pcgKey) {
      return NextResponse.json(
        { ok: false, error: 'Não encontrei a coluna de PCG/PGR no Excel. Verifique o cabeçalho.' },
        { status: 400 },
      );
    }

    const defaultQtd = 1;

    const mapped: ImportRow[] = [];
    for (const r of rawRows) {
      const alterdata_funcao = String(r[funcaoAlterdataKey] ?? '').trim();
      if (!alterdata_funcao) continue;

      const funcao_normalizada = String((funcaoNormalizadaKey ? r[funcaoNormalizadaKey] : undefined) ?? alterdata_funcao).trim();

      const unidade_hospitalar = String(r[setorKey] ?? '').trim();
      const epi_item = String(r[kitKey] ?? '').trim();
      if (!epi_item) continue;

      let pcg = String(r[pcgKey] ?? '').trim();
      if (!pcg) pcg = 'PCG UNIVERSAL';

      // Normaliza sentinelas para bater com comparações exatas do backend
      const pcgUpper = pcg.toUpperCase();
      if (pcgUpper.includes('PCG UNIVERSAL')) pcg = 'PCG UNIVERSAL';
      else if (pcgUpper.includes('SEM MAPEAMENTO') && pcgUpper.includes('PCG')) pcg = 'SEM MAPEAMENTO NO PCG';

      const qtdParsed = qtdKey ? toNumberMaybe(r[qtdKey]) : null;
      const quantidade = qtdParsed && qtdParsed > 0 ? qtdParsed : defaultQtd;

      mapped.push({
        alterdata_funcao,
        funcao_normalizada: funcao_normalizada || alterdata_funcao,
        epi_item,
        quantidade: Number(quantidade),
        pcg,
        unidade_hospitalar,
      });
    }

    if (!mapped.length) {
      return NextResponse.json(
        { ok: false, error: 'Após mapear colunas, não encontrei linhas válidas para importar.' },
        { status: 400 },
      );
    }

    await assertColumnsExist('stg_epi_map');

    // Substitui a base inteira
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE stg_epi_map`);

    const chunk = 800;
    let inserted = 0;
    for (let i = 0; i < mapped.length; i += chunk) {
      const part = mapped.slice(i, i + chunk);
      const values = part
        .map((row) => {
          return `(
            '${escSqlText(row.alterdata_funcao)}',
            '${escSqlText(row.funcao_normalizada)}',
            '${escSqlText(row.epi_item)}',
            ${Number(row.quantidade) || 1},
            '${escSqlText(row.pcg)}',
            '${escSqlText(row.unidade_hospitalar)}'
          )`;
        })
        .join(',');

      await prisma.$executeRawUnsafe(`
        INSERT INTO stg_epi_map (
          alterdata_funcao, funcao_normalizada, epi_item, quantidade, pcg, unidade_hospitalar
        ) VALUES ${values}
      `);
      inserted += part.length;
    }

    // Opcional: audit log
    try {
      const { email } = await requireRootAdmin();
      await prisma.auditLog.create({
        data: {
          actorId: email,
          action: 'epi_map_import',
          entity: 'stg_epi_map',
          entityId: randomUUID(),
          diff: { total_rows: inserted } as any,
        },
      });
    } catch {
      // não bloqueia
    }

    return NextResponse.json({ ok: true, imported: inserted, total_rows: inserted });
  } catch (e: any) {
    console.error('[import/epi-map] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

