import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function toWeekday(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  if (day === 6) out.setDate(out.getDate() - 1);
  else if (day === 0) out.setDate(out.getDate() + 1);
  return out;
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function dateToYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const NOMES: Record<number, string> = {
  1: 'Ofício Comunicação à Unidade e Sindicato',
  2: 'Constituição da Comissão Eleitoral',
  3: 'Convocação para as Inscrições',
  4: 'Período de Inscrição',
  5: 'Edital de Divulgação de Candidatos Inscritos',
  6: 'Período de Campanha Eleitoral',
  7: 'Período da Eleição',
  8: 'Ata de Eleição e Apuração de Votos',
  9: 'Solicitar Indicados',
  10: 'Treinamento CIPA',
  11: 'Emissão Certificado',
  12: 'Reunião de Posse',
};

/**
 * Replica cronograma 2026 a partir das datas de posse 2025. Insere em cronograma_cipa.
 * Usa a mesma lógica de cálculo do list (compute2026From2025).
 */
export async function POST() {
  try {
    // Remove dados 2026 existentes para evitar duplicata (não exige UNIQUE na tabela)
    await prisma.$executeRawUnsafe(`DELETE FROM cronograma_cipa WHERE ano_gestao = 2026`);

    const posseRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT TRIM(regional) AS regional, TRIM(unidade) AS unidade,
             data_posse_gestao::date AS data_posse_gestao
      FROM cronograma_cipa
      WHERE ano_gestao = 2025 AND atividade_codigo = 12 AND data_posse_gestao IS NOT NULL
      ORDER BY regional, unidade
    `);

    let inserted = 0;
    for (const row of posseRows) {
      const reg = String(row.regional ?? '').trim();
      const uni = String(row.unidade ?? '').trim();
      const posse2025 = row.data_posse_gestao instanceof Date ? row.data_posse_gestao : new Date(String(row.data_posse_gestao).slice(0, 10));
      const posse2026 = addDays(posse2025, 364);
      const constituicao = toWeekday(addDays(posse2026, 5));
      const convocacao = addDays(constituicao, 20);
      const edital = addDays(convocacao, 15);
      const campanha = addDays(edital, 1);
      const ata = addDays(posse2026, -30);
      const treinamento = addDays(ata, 2);
      const emissao = addDays(treinamento, 7);
      const oficio = addDays(posse2025, 305);
      const periodoFim = addDays(convocacao, 14);

      const rows: { cod: number; nome: string; inicio: string; fim: string; posse: string }[] = [
        { cod: 1, nome: NOMES[1], inicio: dateToYMD(oficio), fim: dateToYMD(addDays(oficio, 2)), posse: dateToYMD(posse2026) },
        { cod: 2, nome: NOMES[2], inicio: dateToYMD(constituicao), fim: dateToYMD(addDays(constituicao, 2)), posse: dateToYMD(posse2026) },
        { cod: 3, nome: NOMES[3], inicio: dateToYMD(convocacao), fim: dateToYMD(addDays(convocacao, 1)), posse: dateToYMD(posse2026) },
        { cod: 4, nome: NOMES[4], inicio: dateToYMD(convocacao), fim: dateToYMD(periodoFim), posse: dateToYMD(posse2026) },
        { cod: 5, nome: NOMES[5], inicio: dateToYMD(addDays(periodoFim, 1)), fim: dateToYMD(addDays(periodoFim, 2)), posse: dateToYMD(posse2026) },
        { cod: 6, nome: NOMES[6], inicio: dateToYMD(campanha), fim: dateToYMD(addDays(campanha, 3)), posse: dateToYMD(posse2026) },
        { cod: 7, nome: NOMES[7], inicio: dateToYMD(campanha), fim: dateToYMD(addDays(campanha, 3)), posse: dateToYMD(posse2026) },
        { cod: 8, nome: NOMES[8], inicio: dateToYMD(ata), fim: dateToYMD(addDays(ata, 1)), posse: dateToYMD(posse2026) },
        { cod: 9, nome: NOMES[9], inicio: dateToYMD(ata), fim: dateToYMD(addDays(ata, 1)), posse: dateToYMD(posse2026) },
        { cod: 10, nome: NOMES[10], inicio: dateToYMD(treinamento), fim: dateToYMD(addDays(treinamento, 26)), posse: dateToYMD(posse2026) },
        { cod: 11, nome: NOMES[11], inicio: dateToYMD(emissao), fim: dateToYMD(addDays(emissao, 26)), posse: dateToYMD(posse2026) },
        { cod: 12, nome: NOMES[12], inicio: dateToYMD(addDays(posse2026, -1)), fim: dateToYMD(posse2026), posse: dateToYMD(posse2026) },
      ];

      for (const a of rows) {
        const regEsc = reg.replace(/'/g, "''");
        const uniEsc = uni.replace(/'/g, "''");
        const nomeEsc = a.nome.replace(/'/g, "''");
        await prisma.$executeRawUnsafe(`
          INSERT INTO cronograma_cipa (regional, unidade, ano_gestao, atividade_codigo, atividade_nome, data_inicio_prevista, data_fim_prevista, data_posse_gestao)
          VALUES ('${regEsc}', '${uniEsc}', 2026, ${a.cod}, '${nomeEsc}', '${a.inicio}'::date, '${a.fim}'::date, '${a.posse}'::date)
        `);
        inserted++;
      }
    }

    return NextResponse.json({ ok: true, inserted, units: posseRows.length });
  } catch (e: any) {
    console.error('[cipa/replicar-2026] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
