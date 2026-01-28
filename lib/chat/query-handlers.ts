/**
 * Handlers específicos para diferentes tipos de perguntas
 */

import prisma from '@/lib/prisma';
import { findUnidade, findRegional } from './ai-handler';
import { extractLocationNames } from './fuzzy-search';

const DEMISSAO_WHERE = `(
  a.demissao IS NULL
  OR a.demissao = ''
  OR TRIM(a.demissao) = ''
  OR (
    CASE
      WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
      WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
      WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
      ELSE NULL
    END
  ) IS NOT NULL
  AND EXTRACT(YEAR FROM (
    CASE
      WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
      WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
      WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
      ELSE NULL
    END
  ))::int >= 2026
)`;

/**
 * Extrai mês e ano da pergunta
 */
export function extractDate(question: string): { mes?: number; ano?: number } {
  const q = question.toLowerCase();
  const hoje = new Date();
  let mes: number | undefined = hoje.getMonth() + 1;
  let ano: number | undefined = hoje.getFullYear();

  // Extrai ano
  const anoMatch = question.match(/\b(20\d{2})\b/);
  if (anoMatch) {
    ano = parseInt(anoMatch[1], 10);
  }

  // Extrai mês
  const meses: Record<string, number> = {
    janeiro: 1, fevereiro: 2, março: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
    jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
    jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  };

  for (const [nome, num] of Object.entries(meses)) {
    if (q.includes(nome)) {
      mes = num;
      break;
    }
  }

  // "esse mês" / "este mês"
  if (q.includes('esse mes') || q.includes('este mes') || q.includes('mês atual')) {
    mes = hoje.getMonth() + 1;
    ano = hoje.getFullYear();
  }

  return { mes, ano };
}

/**
 * Extrai nome de EPI da pergunta
 */
export function extractEPI(question: string): string | null {
  const q = question.toLowerCase();
  const epis = [
    'máscara n95', 'mascara n95', 'n95',
    'luva nitrílica', 'luva nitrilica', 'luva',
    'óculos', 'oculos',
    'protetor auricular', 'protetor auditivo',
    'capacetes', 'capacete',
    'botas', 'bota',
    'jaleco', 'avental',
  ];

  for (const epi of epis) {
    if (q.includes(epi)) {
      return epi;
    }
  }

  return null;
}

/**
 * Extrai nome de pessoa da pergunta
 */
export function extractPersonName(question: string): string | null {
  // Procura padrões como "do jonathan", "do fulano", "da maria"
  const match = question.match(/\b(?:do|da|de|o|a)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Procura nomes próprios (palavras com inicial maiúscula)
  const words = question.split(/\s+/);
  const names: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (/^[A-Z][a-z]+$/.test(words[i])) {
      names.push(words[i]);
      if (i < words.length - 1 && /^[A-Z][a-z]+$/.test(words[i + 1])) {
        names.push(words[i + 1]);
        i++;
      }
      break;
    }
  }
  
  return names.length > 0 ? names.join(' ') : null;
}

/**
 * Query: Quantos colaboradores tem na unidade X
 */
export async function queryColaboradoresUnidade(question: string): Promise<{ total: number; unidade: string | null }> {
  const locations = extractLocationNames(question);
  let unidade: string | null = null;

  if (locations.unidades.length > 0) {
    for (const loc of locations.unidades) {
      const found = await findUnidade(loc);
      if (found) {
        unidade = found.unidade;
        break;
      }
    }
  }

  if (!unidade) {
    return { total: 0, unidade: null };
  }

  const esc = (s: string) => s.replace(/'/g, "''");
  const where = `WHERE ${DEMISSAO_WHERE} 
    AND COALESCE(a.cpf, '') != '' 
    AND COALESCE(a.funcao, '') != ''
    AND (UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${esc(unidade)}')) 
         OR EXISTS (SELECT 1 FROM stg_unid_reg ur WHERE UPPER(TRIM(ur.nmdepartamento)) = UPPER(TRIM('${esc(unidade)}')) 
                    AND UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(ur.nmdepartamento))))`;

  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(DISTINCT a.cpf)::int AS total
    FROM stg_alterdata_v2 a
    ${where}
  `);

  return { total: rows[0]?.total || 0, unidade };
}

/**
 * Query: Planejado de entrega de EPI (meta) do mês
 */
export async function queryMetaEntrega(question: string): Promise<{ meta: number; mes: number; ano: number }> {
  const { mes, ano } = extractDate(question);
  const locations = extractLocationNames(question);
  let regional: string | null = null;

  if (locations.regionais.length > 0) {
    for (const loc of locations.regionais) {
      const found = await findRegional(loc);
      if (found) {
        regional = found;
        break;
      }
    }
  }

  if (!regional) {
    return { meta: 0, mes: mes || new Date().getMonth() + 1, ano: ano || new Date().getFullYear() };
  }

  // Calcula meta manualmente (soma de EPIs obrigatórios dos colaboradores ativos)
  const esc = (s: string) => s.replace(/'/g, "''");
  try {
    // Busca colaboradores ativos da regional e conta EPIs obrigatórios
    // Nota: A meta real seria a soma de EPIs obrigatórios por função, mas aqui simplificamos
    // contando colaboradores ativos (cada um tem um conjunto de EPIs obrigatórios)
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT a.cpf)::int AS total
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      WHERE ${DEMISSAO_WHERE}
        AND COALESCE(a.cpf, '') != ''
        AND COALESCE(a.funcao, '') != ''
        AND (UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${esc(regional)}'))
             OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
               SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${esc(regional)}'))
             ))
    `);
    // Nota: A meta real seria calculada somando EPIs obrigatórios por função usando epiObrigatorio.ts
    // Por enquanto retornamos o número de colaboradores como aproximação
    return { meta: rows[0]?.total || 0, mes: mes || new Date().getMonth() + 1, ano: ano || new Date().getFullYear() };
  } catch (e) {
    console.error('[queryMetaEntrega] erro:', e);
    return { meta: 0, mes: mes || new Date().getMonth() + 1, ano: ano || new Date().getFullYear() };
  }
}

/**
 * Query: Quantas máscaras N95 entregues na unidade X
 */
export async function queryEPIEntregue(question: string): Promise<{ total: number; epi: string; unidade: string | null }> {
  const epi = extractEPI(question);
  const locations = extractLocationNames(question);
  let unidade: string | null = null;

  if (locations.unidades.length > 0) {
    for (const loc of locations.unidades) {
      const found = await findUnidade(loc);
      if (found) {
        unidade = found.unidade;
        break;
      }
    }
  }

  if (!epi || !unidade) {
    return { total: 0, epi: epi || '', unidade };
  }

  const { mes, ano } = extractDate(question);
  const iniDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const fimDate = new Date(ano || new Date().getFullYear(), mes || new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

  const esc = (s: string) => s.replace(/'/g, "''");
  const rows: any[] = await prisma.$queryRawUnsafe(`
    WITH base AS (
      SELECT e.item, (elem->>'date')::date AS data, (elem->>'qty')::int AS quantidade
      FROM epi_entregas e
      CROSS JOIN LATERAL jsonb_array_elements(e.deliveries) elem
      LEFT JOIN stg_alterdata_v2 a ON a.cpf = e.cpf
      WHERE UPPER(TRIM(e.item)) LIKE UPPER('%${esc(epi)}%')
        AND (elem->>'date')::date >= '${iniDate}' AND (elem->>'date')::date <= '${fimDate}'
        AND (UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${esc(unidade)}'))
             OR EXISTS (SELECT 1 FROM stg_unid_reg ur WHERE UPPER(TRIM(ur.nmdepartamento)) = UPPER(TRIM('${esc(unidade)}'))
                        AND UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(ur.nmdepartamento))))
    )
    SELECT COALESCE(SUM(b.quantidade), 0)::int AS total
    FROM base b
  `);

  return { total: rows[0]?.total || 0, epi, unidade };
}

/**
 * Query: Quantos demitidos em mês/ano
 */
export async function queryDemitidos(question: string): Promise<{ total: number; mes?: number; ano?: number }> {
  const { mes, ano } = extractDate(question);
  const anoUsar = ano || new Date().getFullYear();
  const mesUsar = mes || new Date().getMonth() + 1;

  const esc = (s: string) => s.replace(/'/g, "''");
  let where = `WHERE COALESCE(a.cpf, '') != ''`;

  if (mes) {
    where += ` AND EXTRACT(YEAR FROM (
      CASE
        WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
        WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
        WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
        ELSE NULL
      END
    ))::int = ${anoUsar}
    AND EXTRACT(MONTH FROM (
      CASE
        WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
        WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
        WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
        ELSE NULL
      END
    ))::int = ${mesUsar}
    AND a.demissao IS NOT NULL AND a.demissao != '' AND TRIM(a.demissao) != ''`;
  } else {
    where += ` AND EXTRACT(YEAR FROM (
      CASE
        WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
        WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
        WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
        ELSE NULL
      END
    ))::int = ${anoUsar}
    AND a.demissao IS NOT NULL AND a.demissao != '' AND TRIM(a.demissao) != ''`;
  }

  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(DISTINCT a.cpf)::int AS total
    FROM stg_alterdata_v2 a
    ${where}
  `);

  return { total: rows[0]?.total || 0, mes: mesUsar, ano: anoUsar };
}

/**
 * Query: Última atualização do Alterdata
 */
export async function queryUltimaAtualizacaoAlterdata(): Promise<{ data: string | null }> {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT MAX(updated_at) AS ultima_atualizacao
      FROM stg_alterdata_v2
      WHERE updated_at IS NOT NULL
    `);
    return { data: rows[0]?.ultima_atualizacao ? new Date(rows[0].ultima_atualizacao).toLocaleString('pt-BR') : null };
  } catch {
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(`
        SELECT MAX(imported_at) AS ultima_atualizacao
        FROM stg_alterdata_v2_imports
        WHERE imported_at IS NOT NULL
      `);
      return { data: rows[0]?.ultima_atualizacao ? new Date(rows[0].ultima_atualizacao).toLocaleString('pt-BR') : null };
    } catch {
      return { data: null };
    }
  }
}

/**
 * Query: Acidentes por regional e mês
 */
export async function queryAcidentes(question: string): Promise<{ total: number; regionais: string[]; mes?: number; ano?: number }> {
  const { mes, ano } = extractDate(question);
  const locations = extractLocationNames(question);
  const regionais: string[] = [];

  for (const loc of locations.regionais) {
    const found = await findRegional(loc);
    if (found) {
      regionais.push(found);
    }
  }

  const anoUsar = ano || new Date().getFullYear();
  const mesUsar = mes || new Date().getMonth() + 1;

  if (regionais.length === 0) {
    return { total: 0, regionais: [], mes: mesUsar, ano: anoUsar };
  }

  const esc = (s: string) => s.replace(/'/g, "''");
  const regionaisList = regionais.map(r => `'${esc(r)}'`).join(',');
  
  let where = `WHERE ano = ${anoUsar}`;
  if (mes) {
    where += ` AND EXTRACT(MONTH FROM "dataAcidente") = ${mesUsar}`;
  }

  // Busca acidentes e junta com unidades para filtrar por regional
  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS total
    FROM "Acidente" a
    WHERE ${where}
      AND EXISTS (
        SELECT 1 FROM stg_alterdata_v2 alt
        LEFT JOIN stg_unid_reg ur ON UPPER(TRIM(COALESCE(alt.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(ur.nmdepartamento, '')))
        WHERE alt.cpf = a.colaborador_cpf
          AND (UPPER(TRIM(COALESCE(ur.regional_responsavel, ''))) IN (${regionaisList})
               OR UPPER(TRIM(COALESCE(alt.unidade_hospitalar, ''))) IN (
                 SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) IN (${regionaisList})
               ))
      )
  `);

  return { total: rows[0]?.total || 0, regionais, mes: mesUsar, ano: anoUsar };
}

/**
 * Query: Última acidentada registrada
 */
export async function queryUltimaAcidentada(): Promise<{ nome: string | null; data: string | null }> {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT a.colaborador_nome AS nome, a."dataAcidente" AS data
      FROM "Acidente" a
      WHERE a.colaborador_nome IS NOT NULL
        AND a."dataAcidente" IS NOT NULL
      ORDER BY a."dataAcidente" DESC, a.created_at DESC
      LIMIT 1
    `);
    if (rows.length > 0) {
      return {
        nome: rows[0].nome,
        data: rows[0].data ? new Date(rows[0].data).toLocaleDateString('pt-BR') : null,
      };
    }
  } catch {}
  return { nome: null, data: null };
}

/**
 * Query: Colaborador mais velho (maior tempo de admissão)
 */
export async function queryColaboradorMaisVelho(): Promise<{ nome: string | null; admissao: string | null }> {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT colaborador AS nome, admissao
      FROM stg_alterdata_v2
      WHERE ${DEMISSAO_WHERE}
        AND admissao IS NOT NULL
        AND admissao != ''
        AND TRIM(admissao) != ''
        AND COALESCE(cpf, '') != ''
      ORDER BY (
        CASE
          WHEN TRIM(admissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(admissao)::int))
          WHEN TRIM(admissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(admissao), 1, 10)::date
          WHEN TRIM(admissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(admissao), 1, 10), 'DD/MM/YYYY')
          ELSE NULL
        END
      ) ASC NULLS LAST
      LIMIT 1
    `);
    if (rows.length > 0) {
      const adm = rows[0].admissao;
      let dataAdm: string | null = null;
      try {
        if (/^\d+$/.test(String(adm))) {
          dataAdm = new Date(1899, 11, 30 + parseInt(String(adm), 10)).toLocaleDateString('pt-BR');
        } else if (/^\d{4}-\d{2}-\d{2}/.test(String(adm))) {
          dataAdm = new Date(String(adm).substring(0, 10)).toLocaleDateString('pt-BR');
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(String(adm))) {
          const parts = String(adm).substring(0, 10).split('/');
          dataAdm = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).toLocaleDateString('pt-BR');
        }
      } catch {}
      return { nome: rows[0].nome, admissao: dataAdm };
    }
  } catch {}
  return { nome: null, admissao: null };
}

/**
 * Query: Colaborador que entrou recentemente na unidade X
 */
export async function queryColaboradorRecenteUnidade(question: string): Promise<{ nome: string | null; admissao: string | null; unidade: string | null }> {
  const locations = extractLocationNames(question);
  let unidade: string | null = null;

  if (locations.unidades.length > 0) {
    for (const loc of locations.unidades) {
      const found = await findUnidade(loc);
      if (found) {
        unidade = found.unidade;
        break;
      }
    }
  }

  if (!unidade) {
    return { nome: null, admissao: null, unidade: null };
  }

  const esc = (s: string) => s.replace(/'/g, "''");
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT colaborador AS nome, admissao
      FROM stg_alterdata_v2 a
      WHERE ${DEMISSAO_WHERE}
        AND (UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${esc(unidade)}'))
             OR EXISTS (SELECT 1 FROM stg_unid_reg ur WHERE UPPER(TRIM(ur.nmdepartamento)) = UPPER(TRIM('${esc(unidade)}'))
                        AND UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(ur.nmdepartamento))))
        AND admissao IS NOT NULL
        AND admissao != ''
        AND TRIM(admissao) != ''
        AND COALESCE(cpf, '') != ''
      ORDER BY (
        CASE
          WHEN TRIM(admissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(admissao)::int))
          WHEN TRIM(admissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(admissao), 1, 10)::date
          WHEN TRIM(admissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(admissao), 1, 10), 'DD/MM/YYYY')
          ELSE NULL
        END
      ) DESC NULLS LAST
      LIMIT 1
    `);
    if (rows.length > 0) {
      const adm = rows[0].admissao;
      let dataAdm: string | null = null;
      try {
        if (/^\d+$/.test(String(adm))) {
          dataAdm = new Date(1899, 11, 30 + parseInt(String(adm), 10)).toLocaleDateString('pt-BR');
        } else if (/^\d{4}-\d{2}-\d{2}/.test(String(adm))) {
          dataAdm = new Date(String(adm).substring(0, 10)).toLocaleDateString('pt-BR');
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(String(adm))) {
          const parts = String(adm).substring(0, 10).split('/');
          dataAdm = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).toLocaleDateString('pt-BR');
        }
      } catch {}
      return { nome: rows[0].nome, admissao: dataAdm, unidade };
    }
  } catch {}
  return { nome: null, admissao: null, unidade };
}

/**
 * Query: Função de um colaborador específico
 */
export async function queryFuncaoColaborador(question: string): Promise<{ nome: string | null; funcao: string | null }> {
  const nome = extractPersonName(question);
  if (!nome) {
    return { nome: null, funcao: null };
  }

  const esc = (s: string) => s.replace(/'/g, "''");
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT colaborador AS nome, funcao
      FROM stg_alterdata_v2
      WHERE UPPER(TRIM(colaborador)) LIKE UPPER('%${esc(nome)}%')
        AND COALESCE(funcao, '') != ''
        AND ${DEMISSAO_WHERE}
      ORDER BY colaborador ASC
      LIMIT 1
    `);
    if (rows.length > 0) {
      return { nome: rows[0].nome, funcao: rows[0].funcao };
    }
  } catch {}
  return { nome: null, funcao: null };
}
