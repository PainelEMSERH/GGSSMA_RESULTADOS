import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { compute2026From2025 } from '@/lib/cipa/compute-2026';

/**
 * Replica cronograma 2026 a partir das datas de posse 2025. Insere em cronograma_cipa.
 * Usa a mesma lógica de cálculo da lib (compute2026From2025).
 */
export async function POST() {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM cronograma_cipa WHERE ano_gestao = 2026`);

    const rows2026 = await compute2026From2025(prisma, '', '');
    let inserted = 0;

    for (const a of rows2026) {
      const regEsc = a.regional.replace(/'/g, "''");
      const uniEsc = a.unidade.replace(/'/g, "''");
      const nomeEsc = a.atividade_nome.replace(/'/g, "''");
      await prisma.$executeRawUnsafe(`
        INSERT INTO cronograma_cipa (regional, unidade, ano_gestao, atividade_codigo, atividade_nome, data_inicio_prevista, data_fim_prevista, data_posse_gestao)
        VALUES ('${regEsc}', '${uniEsc}', 2026, ${a.atividade_codigo}, '${nomeEsc}', '${a.data_inicio_prevista}'::date, '${a.data_fim_prevista}'::date, '${a.data_posse_gestao}'::date)
      `);
      inserted++;
    }

    const units = new Set(rows2026.map((r) => `${r.regional}|${r.unidade}`)).size;
    return NextResponse.json({ ok: true, inserted, units });
  } catch (e: any) {
    console.error('[cipa/replicar-2026] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
