/**
 * Handlers específicos para diferentes tipos de perguntas
 */

import prisma from '@/lib/prisma';
import { findUnidade, findRegional } from './ai-handler';
import { extractLocationNames } from './fuzzy-search';
import { fuzzySearch } from './fuzzy-search';
import { calcularStatus } from '@/lib/spci/utils';

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
  // Procura padrões como "do jonathan", "do fulano", "da maria", "colaborador Jonathan Silva Alves"
  const match1 = question.match(/\b(?:do|da|de|o|a)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
  if (match1 && match1[1]) {
    return match1[1].trim();
  }
  
  // Procura após "colaborador" ou "funcionário"
  const match2 = question.match(/\b(?:colaborador|funcionario|funcionário)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (match2 && match2[1]) {
    return match2[1].trim();
  }
  
  // Procura nomes próprios (palavras com inicial maiúscula) - pega todas as palavras consecutivas
  const words = question.split(/\s+/);
  const names: string[] = [];
  let collecting = false;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Remove pontuação no final
    const cleanWord = word.replace(/[.,!?;:]$/, '');
    if (/^[A-Z][a-z]+$/.test(cleanWord)) {
      names.push(cleanWord);
      collecting = true;
    } else if (collecting) {
      // Se estava coletando e encontrou uma palavra que não é nome próprio, para
      break;
    }
  }
  
  return names.length > 0 ? names.join(' ') : null;
}

/**
 * Query: Verifica se uma unidade existe (com fuzzy + sugestões).
 * Retorna o melhor match e até 5 sugestões.
 */
export async function queryUnidadeExiste(question: string): Promise<{
  existe: boolean;
  unidadeInformada: string | null;
  melhorMatch: { unidade: string; regional: string } | null;
  sugestoes: Array<{ unidade: string; regional: string; score: number }>;
}> {
  const locations = extractLocationNames(question);
  const unidadeInformada = locations.unidades?.[0] ? String(locations.unidades[0]).trim() : null;

  if (!unidadeInformada) {
    return { existe: false, unidadeInformada: null, melhorMatch: null, sugestoes: [] };
  }

  // Carrega lista atual de unidades do banco (sempre atualiza com novos imports)
  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT nmdepartamento AS unidade, regional_responsavel AS regional
    FROM stg_unid_reg
    WHERE COALESCE(nmdepartamento,'') != ''
  `);

  const candidates = rows.map((r) => String(r.unidade || '').trim()).filter(Boolean);
  const byName = new Map<string, { unidade: string; regional: string }>();
  for (const r of rows) {
    const u = String(r.unidade || '').trim();
    const reg = String(r.regional || '').trim();
    if (u) byName.set(u, { unidade: u, regional: reg });
  }

  const matches = fuzzySearch(unidadeInformada, candidates, 0.35).slice(0, 5);
  const sugestoes = matches
    .map((m) => {
      const info = byName.get(m.text);
      return { unidade: m.text, regional: info?.regional || '', score: m.score };
    })
    .filter((x) => x.unidade);

  const melhor = sugestoes[0] || null;
  const existe = !!melhor && melhor.score >= 0.55;

  return {
    existe,
    unidadeInformada,
    melhorMatch: melhor ? { unidade: melhor.unidade, regional: melhor.regional } : null,
    sugestoes,
  };
}

/**
 * Query: busca colaborador por nome ("encontre/procure o João da Silva").
 * Retorna até 10 correspondências com nome, CPF, unidade, regional, função e se está ativo.
 */
export async function queryBuscarColaborador(question: string): Promise<{
  nomeBuscado: string | null;
  resultados: Array<{
    nome: string;
    cpf: string;
    unidade: string;
    regional: string;
    funcao: string;
    ativo: boolean;
  }>;
}> {
  // Tenta extrair nome da frase
  let nome = extractPersonName(question);

  if (!nome) {
    // Fallback: tudo depois de "encontre"/"procure"/"achar"
    const m = question.match(/(?:encontra(?:r)?|procura(?:r)?|achar?)\s+(.+)/i);
    if (m && m[1]) {
      nome = m[1].trim();
    }
  }

  if (!nome || nome.split(/\s+/).length === 0) {
    return { nomeBuscado: null, resultados: [] };
  }

  const esc = (s: string) => s.replace(/'/g, "''");
  const nomeLike = `%${esc(nome)}%`;

  const rows: any[] = await prisma.$queryRawUnsafe(
    `
      SELECT DISTINCT ON (a.cpf)
        COALESCE(a.colaborador, '')        AS nome,
        COALESCE(a.cpf, '')                AS cpf,
        COALESCE(a.unidade_hospitalar, '') AS unidade_hospitalar,
        COALESCE(u.regional_responsavel, '') AS regional,
        COALESCE(a.funcao, '')            AS funcao,
        CASE
          WHEN ${DEMISSAO_WHERE} THEN true
          ELSE false
        END AS ativo
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u
        ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, '')))
         = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      WHERE UPPER(TRIM(a.colaborador)) LIKE UPPER('${nomeLike}')
         OR UPPER(TRIM(a.cpf)) LIKE UPPER('${nomeLike}')
      ORDER BY a.cpf, a.colaborador ASC
      LIMIT 10
    `
  );

  const resultados = rows.map((r) => ({
    nome: String(r.nome || '').trim(),
    cpf: String(r.cpf || '').trim(),
    unidade: String(r.unidade_hospitalar || '').trim(),
    regional: String(r.regional || '').trim(),
    funcao: String(r.funcao || '').trim(),
    ativo: !!r.ativo,
  }));

  return { nomeBuscado: nome, resultados };
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

/**
 * Query: Matrícula de um colaborador específico
 */
export async function queryMatriculaColaborador(question: string): Promise<{ nome: string | null; matricula: string | null }> {
  const nome = extractPersonName(question);
  if (!nome) {
    return { nome: null, matricula: null };
  }

  const esc = (s: string) => s.replace(/'/g, "''");
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT colaborador AS nome, matricula
      FROM stg_alterdata_v2
      WHERE UPPER(TRIM(colaborador)) LIKE UPPER('%${esc(nome)}%')
        AND COALESCE(matricula, '') != ''
        AND ${DEMISSAO_WHERE}
      ORDER BY colaborador ASC
      LIMIT 1
    `);
    if (rows.length > 0) {
      return { nome: rows[0].nome, matricula: rows[0].matricula };
    }
  } catch {}
  return { nome: null, matricula: null };
}

/**
 * Query: Extintores por unidade/regional
 */
export async function queryExtintores(question: string): Promise<{ total: number; vencidos: number; dentroPrazo: number; unidade: string | null; regional: string | null }> {
  const locations = extractLocationNames(question);
  let unidade: string | null = null;
  let regional: string | null = null;

  if (locations.unidades.length > 0) {
    for (const loc of locations.unidades) {
      const found = await findUnidade(loc);
      if (found) {
        unidade = found.unidade;
        if (!regional && found.regional) {
          regional = found.regional;
        }
        break;
      }
    }
  }

  if (locations.regionais.length > 0 && !regional) {
    for (const loc of locations.regionais) {
      const found = await findRegional(loc);
      if (found) {
        regional = found;
        break;
      }
    }
  }

  const esc = (s: string) => s.replace(/'/g, "''");
  let whereSql = '';
  const conditions: string[] = [];

  if (regional) {
    conditions.push(`"Regional" = '${esc(regional)}'`);
  }
  if (unidade) {
    conditions.push(`TRIM("Unidade") ILIKE '%${esc(unidade)}%'`);
  }

  if (conditions.length > 0) {
    whereSql = `WHERE ${conditions.join(' AND ')}`;
  }

  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT "Unidade", "Regional", "Última recarga"
    FROM spci_planilha
    ${whereSql}
  `);

  let total = 0;
  let vencidos = 0;
  let dentroPrazo = 0;
  
  for (const row of rows) {
    total++;
    const calculo = calcularStatus(row['Última recarga']);
    if (calculo.status === 'VENCIDO') vencidos++;
    else dentroPrazo++;
  }

  return { total, vencidos, dentroPrazo, unidade, regional };
}

/**
 * Query: Estoque (itens abaixo do mínimo)
 */
export async function queryEstoque(question: string): Promise<{ items: Array<{ unidade: string; item: string; quantidade: number; minimo: number }>; unidade: string | null; regional: string | null }> {
  const locations = extractLocationNames(question);
  let unidade: string | null = null;
  let regional: string | null = null;

  if (locations.unidades.length > 0) {
    for (const loc of locations.unidades) {
      const found = await findUnidade(loc);
      if (found) {
        unidade = found.unidade;
        break;
      }
    }
  }

  if (locations.regionais.length > 0 && !regional) {
    for (const loc of locations.regionais) {
      const found = await findRegional(loc);
      if (found) {
        regional = found;
        break;
      }
    }
  }

  const esc = (s: string) => s.replace(/'/g, "''");
  let where = `WHERE e.quantidade < e.minimo`;
  const params: any[] = [];
  let paramIndex = 1;

  if (regional) {
    params.push(regional);
    where += ` AND EXISTS (SELECT 1 FROM "Regional" r WHERE r.id = u."regionalId" AND UPPER(TRIM(r.nome)) = UPPER(TRIM($${paramIndex})))`;
    paramIndex++;
  }
  if (unidade) {
    params.push(`%${unidade}%`);
    where += ` AND UPPER(TRIM(u.nome)) LIKE UPPER($${paramIndex})`;
    paramIndex++;
  }

  const rows: any[] = params.length > 0
    ? await prisma.$queryRawUnsafe(`
        SELECT u.nome AS unidade, i.nome AS item, e.quantidade::int, e.minimo::int
        FROM "Estoque" e
        JOIN "Item" i ON i.id = e."itemId"
        JOIN "Unidade" u ON u.id = e."unidadeId"
        ${where}
        ORDER BY e.quantidade ASC
        LIMIT 20
      `, ...params)
    : await prisma.$queryRawUnsafe(`
        SELECT u.nome AS unidade, i.nome AS item, e.quantidade::int, e.minimo::int
        FROM "Estoque" e
        JOIN "Item" i ON i.id = e."itemId"
        JOIN "Unidade" u ON u.id = e."unidadeId"
        ${where}
        ORDER BY e.quantidade ASC
        LIMIT 20
      `);

  const items = rows.map((r: any) => ({
    unidade: String(r.unidade || ''),
    item: String(r.item || ''),
    quantidade: Number(r.quantidade || 0),
    minimo: Number(r.minimo || 0),
  }));

  return { items, unidade, regional };
}
