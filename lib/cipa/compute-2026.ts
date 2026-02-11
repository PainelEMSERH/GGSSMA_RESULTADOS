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
 * Calcula cronograma 2026 a partir da data de posse da gestão anterior (no banco: 2025 guarda "posse gestão 2024", ex: 28/08/2024).
 * Para 2026 a referência é a posse 2025 = posse do banco + 365 dias (ex: 28/08/2025).
 * Regras:
 * - Posse ano anterior (para 2026) = posse gestão no banco + 365
 * - Reunião de Posse 2026 = posse ano anterior + 364
 * - Ofício = posse ano anterior + 305 (1 ano - 60 dias)
 * - Constituição = posse 2026 + 5 (sábado→sexta, domingo→segunda)
 * - Ata = posse 2026 - 30 | Convocação = Ata - 20
 * - Período de Inscrição = Convocação (início); fim = Convocação + 14
 * - Edital = fim período inscrição + 1 | Campanha = Edital + 1 | Eleição = Campanha
 * - Solicitar Indicados = Ata | Treinamento = Ata + 2 | Emissão = Treinamento + 7
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

  // Uma linha por (regional, unidade) com a data de posse daquela unidade (ex: 2024-05-17 ou 2024-08-28).
  // Para 2026 usamos a data de posse de cada unidade, não uma data padrão para todas.
  const posseRows: any[] = await p.$queryRawUnsafe(`
    SELECT DISTINCT TRIM(regional) AS regional, TRIM(unidade) AS unidade,
           data_posse_gestao::text AS data_posse_gestao
    FROM cronograma_cipa
    ${whereSql}
    AND data_posse_gestao IS NOT NULL
    ORDER BY regional, unidade
  `);

  const ANO_GESTAO = 2026;
  const out: Row2026[] = [];
  for (const row of posseRows) {
    const reg = String(row.regional ?? '').trim();
    const uni = String(row.unidade ?? '').trim();
    // Data de posse desta unidade (gestão anterior no banco); cada unidade pode ter data diferente.
    const posseGestaoAnteriorStr = String(row.data_posse_gestao ?? '').slice(0, 10);
    if (!posseGestaoAnteriorStr || !/^\d{4}-\d{2}-\d{2}$/.test(posseGestaoAnteriorStr)) continue;
    const [y, mo, d] = posseGestaoAnteriorStr.split('-').map(Number);
    const posseGestaoAnterior = new Date(y, mo - 1, d);

    // No banco, a linha de 2025 guarda "DATA DA POSSE GESTÃO 2024" (ex: 28/08/2024).
    // Para 2026 usamos "data de posse da CIPA do ano anterior" = posse 2025 = 28/08/2025.
    // Então: posse 2025 = posse gestão anterior (do banco) + 365 dias.
    const posseAnoAnterior = addDays(posseGestaoAnterior, 365);

    // Reunião de Posse 2026 = data de posse do ano anterior + 365 - 1 = posse 2025 + 364
    const posse = addDays(posseAnoAnterior, 364);

    // Constituição = data da posse + 5 dias (sábado→sexta, domingo→segunda)
    const constituicao = toWeekday(addDays(posse, 5));

    // Ata = data da posse + um ano - 30 dias
    const ata = addDays(posse, -30);
    // Convocação = Ata - 20 dias
    const convocacao = addDays(ata, -20);

    // Período de Inscrição = Convocação (início); fim = Convocação + 14
    const periodoInicio = convocacao;
    const periodoFim = addDays(convocacao, 14);
    // Edital = conclusão do período de inscrições + 1
    const edital = addDays(periodoFim, 1);
    // Campanha = Edital + 1 | Eleição = Campanha
    const campanha = addDays(edital, 1);

    // Ofício = posse do ano anterior + 1 ano - 60 dias (posse 2025 + 305)
    const oficio = addDays(posseAnoAnterior, 305);

    const treinamento = addDays(ata, 2);
    const emissao = addDays(treinamento, 7);

    const activities: { cod: number; nome: string; inicio: Date; fim: Date; posse: Date }[] = [
      { cod: 1, nome: NOMES_ATIVIDADES[1], inicio: oficio, fim: addDays(oficio, 2), posse },
      { cod: 2, nome: NOMES_ATIVIDADES[2], inicio: constituicao, fim: addDays(constituicao, 2), posse },
      { cod: 3, nome: NOMES_ATIVIDADES[3], inicio: convocacao, fim: addDays(convocacao, 1), posse },
      { cod: 4, nome: NOMES_ATIVIDADES[4], inicio: periodoInicio, fim: periodoFim, posse },
      { cod: 5, nome: NOMES_ATIVIDADES[5], inicio: edital, fim: addDays(edital, 1), posse },
      { cod: 6, nome: NOMES_ATIVIDADES[6], inicio: campanha, fim: addDays(campanha, 3), posse },
      { cod: 7, nome: NOMES_ATIVIDADES[7], inicio: campanha, fim: addDays(campanha, 3), posse },
      { cod: 8, nome: NOMES_ATIVIDADES[8], inicio: ata, fim: addDays(ata, 1), posse },
      { cod: 9, nome: NOMES_ATIVIDADES[9], inicio: ata, fim: addDays(ata, 1), posse },
      { cod: 10, nome: NOMES_ATIVIDADES[10], inicio: treinamento, fim: addDays(treinamento, 26), posse },
      { cod: 11, nome: NOMES_ATIVIDADES[11], inicio: emissao, fim: addDays(emissao, 26), posse },
      { cod: 12, nome: NOMES_ATIVIDADES[12], inicio: addDays(posse, -1), fim: posse, posse },
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
