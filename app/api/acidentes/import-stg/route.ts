export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

/** Colunas da stg_acidentes (sem mes/ano – preenchidos por trigger) */
const STG_COLUMNS = [
  'CdChamada', 'NmFuncionario', 'nmdepartamento', 'nmcidade', 'nmfuncao',
  'DtNascimento', 'DtAdmissao', 'DtDemissao', 'NrCPF', 'TpEstadoCivil', 'TpSexo',
  'numero_cat', 'data_acidente', 'hora_acidente', 'cat_parcial', 'comunicou_policia', 'houve_obito',
  'tipo_acidente_codigo', 'local_acidente_especificacao', 'local_acidente_complemento',
  'local_acidente_bairro', 'local_acidente_logradouro', 'local_acidente_numero', 'local_acidente_municipio',
  'atestado_cnes_unidade', 'data_atendimento', 'numero_dias_tratamento',
  'houve_internacao', 'houve_afastamento', 'codigo_cid', 'descricao_complementar_lesao',
  'atestado_observacoes', 'diagnostico_provavel', 'situacao_geradora_codigo', 'natureza_lesao_codigo',
  'observacoes_cat', 'parte_atingida_codigo', 'descricao_natureza_lesao', 'descricao_situacao_geradora',
  'Tipo_Acidente', 'real_extraido', 'Real', 'Potencial', 'hora_formatada', 'Regional',
];

function parseCSVSemicolon(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const sep = ';';
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === sep && !inQ) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => {
      obj[h] = (cells[j] ?? '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

function getCell(row: Record<string, string>, col: string): string {
  if (row[col] !== undefined && row[col] !== '') return row[col];
  const key = Object.keys(row).find((k) => k.trim() === col || k.trim() === col.trim());
  return key ? row[key] : '';
}

function rowToValues(row: Record<string, string>): (string | number | null)[] {
  return STG_COLUMNS.map((col) => {
    const raw = getCell(row, col);
    if (col === 'numero_dias_tratamento') {
      const n = parseInt(String(raw).replace(/\D/g, ''), 10);
      return Number.isNaN(n) ? null : n;
    }
    return raw === '' || raw == null ? null : String(raw);
  });
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: 'Envie um arquivo .csv (separador ;) ou .xlsx' }, { status: 400 });
    }

    const filename = (file.name || '').toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    let rows: Record<string, string>[] = [];
    if (filename.endsWith('.xlsx')) {
      const xlsx = await import('xlsx');
      const wb = xlsx.read(buf, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const arr = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, unknown>[];
      rows = arr.map((r) => {
        const out: Record<string, string> = {};
        for (const k of Object.keys(r)) out[String(k).trim()] = r[k] == null ? '' : String(r[k]);
        return out;
      });
    } else {
      const text = buf.toString('utf8');
      rows = parseCSVSemicolon(text);
    }

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'Arquivo vazio ou sem linhas de dados' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(`TRUNCATE TABLE stg_acidentes RESTART IDENTITY`);

    const BATCH = 50;
    let imported = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values: (string | number | null)[] = [];
      const placeholders: string[] = [];
      batch.forEach((row, idx) => {
        const vals = rowToValues(row);
        const base = idx * STG_COLUMNS.length;
        placeholders.push(
          `(${STG_COLUMNS.map((_, j) => `$${base + j + 1}`).join(',')})`
        );
        values.push(...vals);
      });

      const cols = STG_COLUMNS.map((c) => (/[A-Z]/.test(c) ? `"${c}"` : c)).join(',');
      const sql = `INSERT INTO stg_acidentes (${cols}) VALUES ${placeholders.join(',')}`;
      await prisma.$executeRawUnsafe(sql, ...values);
      imported += batch.length;
    }

    return NextResponse.json({
      ok: true,
      imported,
      message: `Base anterior apagada. ${imported} registro(s) importado(s).`,
    });
  } catch (e: any) {
    console.error('[acidentes/import-stg] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
