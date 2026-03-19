import type { PrismaClient } from '@prisma/client';

function cleanFuncaoAlterdata(s: string): string {
  return String(s || '')
    .replace(/\(A\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve uma função do Alterdata para a função NORMALIZADA do `stg_epi_map`.
 *
 * Ex.: "ENFERMEIRO(A) UTI ADULTO" -> "ENFERMEIRO"
 *
 * Estratégia:
 * - Tenta match exato por `alterdata_funcao` (case/trim) com o valor bruto.
 * - Se não achar, tenta de novo removendo "(A)" e espaços duplicados.
 * - Se houver múltiplas normalizações possíveis, escolhe a mais frequente.
 * - Retorna `null` se não encontrar.
 */
export async function resolveFuncaoNormalizadaFromMap(
  prisma: PrismaClient,
  funcaoAlterdataRaw: string,
): Promise<string | null> {
  const raw = String(funcaoAlterdataRaw || '').trim();
  if (!raw) return null;

  const cleaned = cleanFuncaoAlterdata(raw);

  const query = async (value: string) => {
    const rows: Array<{ funcao_normalizada: string | null }> = await prisma.$queryRawUnsafe(
      `
      SELECT funcao_normalizada
      FROM stg_epi_map
      WHERE UPPER(TRIM(COALESCE(alterdata_funcao, ''))) = UPPER(TRIM($1))
        AND TRIM(COALESCE(funcao_normalizada, '')) <> ''
      GROUP BY funcao_normalizada
      ORDER BY COUNT(*) DESC, funcao_normalizada ASC
      LIMIT 1
      `,
      value,
    );
    const picked = rows?.[0]?.funcao_normalizada ? String(rows[0].funcao_normalizada).trim() : '';
    return picked || null;
  };

  const fromRaw = await query(raw);
  if (fromRaw) return fromRaw;

  if (cleaned && cleaned !== raw) {
    const fromCleaned = await query(cleaned);
    if (fromCleaned) return fromCleaned;
  }

  return null;
}

