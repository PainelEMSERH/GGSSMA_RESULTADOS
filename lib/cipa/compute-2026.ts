import type { PrismaClient } from '@prisma/client';

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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const NOMES_ATIVIDADES: Record<number, string> = {
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

export type Row2026 = {
  id: string;
  regional: string;
  unidade: string;
  ano_gestao: number;
  atividade_codigo: number;
  atividade_nome: string;
  data_inicio_prevista: string;
  data_fim_prevista: string;
  data_conclusao: null;
  data_posse_gestao: string;
};

/**
 * Calcula cronograma 2026 a partir da data de posse 2025 por unidade.
 * Regras:
 * - Posse 2026 = posse ano anterior + 365 dias - 1
 * - Ofício = posse ano anterior + 1 ano - 60 dias
 * - Constituição = posse 2026 + 5 dias (sábado→sexta, domingo→segunda)
 * - Ata = posse 2026 - 30 dias
 * - Convocação = Ata - 20 dias
 * - Período de Inscrição = Convocação (início); fim = Convocação + 14
 * - Edital = conclusão período inscrição + 1
 * - Campanha = Edital + 1 | Eleição = Campanha
 * - Solicitar Indicados = Ata | Treinamento = Ata + 2 | Emissão = Treinamento + 7
 * - Reunião de Posse = posse ano anterior + 365 - 1
 */
export async function compute2026From2025(
  p: Pick<PrismaClient, '$queryRawUnsafe'>,
  filterRegional: string,
  filterUnidade: string
): Promise<Row2026[]> {
  const wh: string[] = ['ano_gestao = 2025', 'atividade_codigo = 12'];
  if (filterRegional) wh.push(`TRIM(regional) = '${String(filterRegional).replace(/'/g, "''")}'`);
  if (filterUnidade) wh.push(`TRIM(unidade) = '${String(filterUnidade).replace(/'/g, "''")}'`);
  const whereSql = `WHERE ${wh.join(' AND ')}`;

  const posseRows: any[] = await p.$queryRawUnsafe(`
    SELECT DISTINCT TRIM(regional) AS regional, TRIM(unidade) AS unidade,
           data_posse_gestao::text AS data_posse_gestao
    FROM cronograma_cipa
    ${whereSql}
    AND data_posse_gestao IS NOT NULL
    ORDER BY regional, unidade
  `);

  const out: Row2026[] = [];
  for (const row of posseRows) {
    const reg = String(row.regional ?? '').trim();
    const uni = String(row.unidade ?? '').trim();
    const posse2025Str = String(row.data_posse_gestao ?? '').slice(0, 10);
    if (!posse2025Str || !/^\d{4}-\d{2}-\d{2}$/.test(posse2025Str)) continue;
    const [y, m, d] = posse2025Str.split('-').map(Number);
    const posse2025 = new Date(y, m - 1, d);

    // Reunião de Posse = posse ano anterior + 365 - 1
    const posse2026 = addDays(posse2025, 364);

    // Ofício = posse ano anterior + 1 ano - 60 dias
    const oficio = addDays(posse2025, 305);

    // Constituição = posse 2026 + 5 dias (sábado→sexta, domingo→segunda)
    const constituicao = toWeekday(addDays(posse2026, 5));

    // Ata = posse 2026 - 30 dias
    const ata = addDays(posse2026, -30);
    // Convocação = Ata - 20 dias
    const convocacao = addDays(ata, -20);

    // Período de Inscrição = Convocação (início); fim = Convocação + 14
    const periodoInicio = convocacao;
    const periodoFim = addDays(convocacao, 14);
    // Edital = conclusão período inscrição + 1
    const edital = addDays(periodoFim, 1);
    // Campanha = Edital + 1 | Eleição = Campanha
    const campanha = addDays(edital, 1);

    const treinamento = addDays(ata, 2);
    const emissao = addDays(treinamento, 7);

    const activities: { cod: number; nome: string; inicio: Date; fim: Date; posse: Date }[] = [
      { cod: 1, nome: NOMES_ATIVIDADES[1], inicio: oficio, fim: addDays(oficio, 2), posse: posse2026 },
      { cod: 2, nome: NOMES_ATIVIDADES[2], inicio: constituicao, fim: addDays(constituicao, 2), posse: posse2026 },
      { cod: 3, nome: NOMES_ATIVIDADES[3], inicio: convocacao, fim: addDays(convocacao, 1), posse: posse2026 },
      { cod: 4, nome: NOMES_ATIVIDADES[4], inicio: periodoInicio, fim: periodoFim, posse: posse2026 },
      { cod: 5, nome: NOMES_ATIVIDADES[5], inicio: edital, fim: addDays(edital, 1), posse: posse2026 },
      { cod: 6, nome: NOMES_ATIVIDADES[6], inicio: campanha, fim: addDays(campanha, 3), posse: posse2026 },
      { cod: 7, nome: NOMES_ATIVIDADES[7], inicio: campanha, fim: addDays(campanha, 3), posse: posse2026 },
      { cod: 8, nome: NOMES_ATIVIDADES[8], inicio: ata, fim: addDays(ata, 1), posse: posse2026 },
      { cod: 9, nome: NOMES_ATIVIDADES[9], inicio: ata, fim: addDays(ata, 1), posse: posse2026 },
      { cod: 10, nome: NOMES_ATIVIDADES[10], inicio: treinamento, fim: addDays(treinamento, 26), posse: posse2026 },
      { cod: 11, nome: NOMES_ATIVIDADES[11], inicio: emissao, fim: addDays(emissao, 26), posse: posse2026 },
      { cod: 12, nome: NOMES_ATIVIDADES[12], inicio: addDays(posse2026, -1), fim: posse2026, posse: posse2026 },
    ];

    for (const a of activities) {
      out.push({
        id: `2026-${reg}-${uni}-${a.cod}`,
        regional: reg,
        unidade: uni,
        ano_gestao: 2026,
        atividade_codigo: a.cod,
        atividade_nome: a.nome,
        data_inicio_prevista: dateToYMD(a.inicio),
        data_fim_prevista: dateToYMD(a.fim),
        data_conclusao: null,
        data_posse_gestao: dateToYMD(a.posse),
      });
    }
  }
  return out.sort((a, b) => {
    if (a.regional !== b.regional) return a.regional.localeCompare(b.regional);
    if (a.unidade !== b.unidade) return a.unidade.localeCompare(b.unidade);
    return a.atividade_codigo - b.atividade_codigo;
  });
}
