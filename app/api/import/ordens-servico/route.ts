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

async function ensureOrdensServicoTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_ordens_servico_raw (
      id BIGSERIAL PRIMARY KEY,
      batch_id UUID NOT NULL,
      row_no INTEGER NOT NULL,
      data JSONB NOT NULL,
      source_file TEXT,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_ordens_servico_imports (
      batch_id UUID PRIMARY KEY,
      source_file TEXT,
      total_rows INTEGER,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_ordens_servico (
      id BIGSERIAL PRIMARY KEY,
      numero TEXT,
      data_abertura DATE,
      data_fechamento DATE,
      unidade TEXT,
      regional TEXT,
      tipo_servico TEXT,
      descricao TEXT,
      solicitante TEXT,
      status TEXT,
      prioridade TEXT,
      responsavel TEXT,
      valor_estimado NUMERIC(10,2),
      valor_realizado NUMERIC(10,2),
      observacoes TEXT,
      last_batch_id UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION apply_ordens_servico_batch(p_batch UUID)
    RETURNS VOID AS $$
    BEGIN
      INSERT INTO stg_ordens_servico (
        numero, data_abertura, data_fechamento, unidade, regional, tipo_servico,
        descricao, solicitante, status, prioridade, responsavel, valor_estimado,
        valor_realizado, observacoes, last_batch_id, updated_at
      )
      SELECT
        NULLIF(TRIM(data->>'Número OS' || data->>'Numero OS' || data->>'numero' || data->>'Número'), '')::text,
        CASE
          WHEN data->>'Data Abertura' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'Data Abertura')::date
          WHEN data->>'Data Abertura' ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(data->>'Data Abertura', 'DD/MM/YYYY')
          ELSE NULL
        END,
        CASE
          WHEN data->>'Data Fechamento' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'Data Fechamento')::date
          WHEN data->>'Data Fechamento' ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(data->>'Data Fechamento', 'DD/MM/YYYY')
          ELSE NULL
        END,
        NULLIF(TRIM(data->>'Unidade' || data->>'unidade'), '')::text,
        NULLIF(TRIM(data->>'Regional' || data->>'regional'), '')::text,
        NULLIF(TRIM(data->>'Tipo de Serviço' || data->>'Tipo Servico' || data->>'tipo_servico'), '')::text,
        NULLIF(TRIM(data->>'Descrição' || data->>'Descricao' || data->>'descricao'), '')::text,
        NULLIF(TRIM(data->>'Solicitante' || data->>'solicitante'), '')::text,
        NULLIF(TRIM(data->>'Status' || data->>'status'), '')::text,
        NULLIF(TRIM(data->>'Prioridade' || data->>'prioridade'), '')::text,
        NULLIF(TRIM(data->>'Responsável' || data->>'Responsavel' || data->>'responsavel'), '')::text,
        CASE WHEN (data->>'Valor Estimado' || data->>'valor_estimado')::text ~ '^[0-9.,]+$'
          THEN REPLACE(REPLACE((data->>'Valor Estimado' || data->>'valor_estimado')::text, '.', ''), ',', '.')::numeric
          ELSE NULL END,
        CASE WHEN (data->>'Valor Realizado' || data->>'valor_realizado')::text ~ '^[0-9.,]+$'
          THEN REPLACE(REPLACE((data->>'Valor Realizado' || data->>'valor_realizado')::text, '.', ''), ',', '.')::numeric
          ELSE NULL END,
        NULLIF(TRIM(data->>'Observações' || data->>'Observacoes' || data->>'observacoes'), '')::text,
        batch_id,
        now()
      FROM stg_ordens_servico_raw
      WHERE batch_id = p_batch
      ON CONFLICT DO NOTHING;
    END;
    $$ LANGUAGE plpgsql
  `);
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        out.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(l => {
    const cells = parseLine(l);
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); });
    return o;
  });
  return { headers, rows };
}

export async function POST(req: Request) {
  try {
    const { email } = await requireRootAdmin();
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ ok: false, error: 'Envie um arquivo .xlsx ou .csv' }, { status: 400 });

    const filename = (file.name || 'ordens_servico').toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    await ensureOrdensServicoTables();

    let rows: any[] = [];
    if (filename.endsWith('.xlsx')) {
      try {
        const xlsx = await import('xlsx');
        const wb = xlsx.read(buf, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: 'Erro ao ler arquivo Excel. Tente salvar como CSV UTF-8.' }, { status: 400 });
      }
    } else {
      const text = buf.toString('utf8');
      const parsed = parseCSV(text);
      rows = parsed.rows;
    }

    if (!rows.length) return NextResponse.json({ ok: false, error: 'Arquivo vazio' }, { status: 400 });

    const batchId = randomUUID();
    const source = file.name || 'upload';
    const user = email || 'admin';
    let inserted = 0;

    const chunk = 500;
    for (let i = 0; i < rows.length; i += chunk) {
      const part = rows.slice(i, i + chunk);
      const values = part.map((r, idx) => {
        const rowNo = i + idx + 1;
        const json = JSON.stringify(r).replace(/'/g, "''");
        return `('${batchId}'::uuid, ${rowNo}, '${json}'::jsonb, '${source}', '${user}')`;
      }).join(',\n');
      const sql = `INSERT INTO stg_ordens_servico_raw (batch_id, row_no, data, source_file, imported_by) VALUES ${values}`;
      await prisma.$executeRawUnsafe(sql);
      inserted += part.length;
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO stg_ordens_servico_imports (batch_id, source_file, total_rows, imported_by)
      VALUES ('${batchId}'::uuid, '${source}', ${inserted}, '${user}')
      ON CONFLICT (batch_id) DO NOTHING
    `);

    await prisma.$executeRawUnsafe(`SELECT apply_ordens_servico_batch('${batchId}'::uuid)`);

    return NextResponse.json({ ok: true, batchId, total_rows: inserted });
  } catch (e: any) {
    console.error('[import/ordens-servico] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
