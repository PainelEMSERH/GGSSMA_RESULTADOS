// file: app/api/kits/map/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/kits/map
 *
 * Mapa consolidado de EPIs por função, com base na tabela public.stg_epi_map.
 * Deduplica combinações de (função, item, unidade) para evitar linhas duplicadas
 * que inflariam a contagem de itens na tela de "Mapa de kits por função".
 *
 * Query params:
 *  - q: string       (filtro por função OU item) [opcional]
 *  - unidade: string (filtra por unidade_hospitalar) [opcional]
 *  - page, size: paginação                       [opcionais]
 *
 * Retorna linhas no formato:
 *  { funcao: string, item: string, quantidade: number, unidade: string }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const unidade = (searchParams.get('unidade') || '').trim();
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const size = Math.min(500, Math.max(10, Number(searchParams.get('size') || '100')));
    const offset = (page - 1) * size;

    const where: string[] = [];
    const params: any[] = [];

    if (q) {
      const like = `%${q.toUpperCase()}%`;
      params.push(like);
      where.push(
        `(UPPER(m.alterdata_funcao) LIKE $${params.length} OR UPPER(m.epi_item) LIKE $${params.length})`,
      );
    }

    if (unidade) {
      params.push(`%${unidade.toUpperCase()}%`);
      where.push(`(
        UPPER(TRIM(COALESCE(m.unidade_hospitalar, ''))) LIKE $${params.length}
        OR (m.pcg = 'PCG UNIVERSAL' AND 'PCG UNIVERSAL' LIKE $${params.length})
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Unidade: PCG UNIVERSAL quando pcg = 'PCG UNIVERSAL' e sem unidade_hospitalar (igual entregas/kit)
    const unidadeSel = `COALESCE(
      CASE WHEN m.pcg = 'PCG UNIVERSAL' AND (m.unidade_hospitalar IS NULL OR TRIM(COALESCE(m.unidade_hospitalar, '')) = '')
        THEN 'PCG UNIVERSAL'
        ELSE NULLIF(TRIM(COALESCE(m.unidade_hospitalar, '')), '')
      END,
      '—'
    )`;
    // Função: prioriza funcao_normalizada, fallback alterdata_funcao
    const funcaoSel = `TRIM(COALESCE(m.funcao_normalizada, m.alterdata_funcao, ''))`;

    // Linhas deduplicadas por (função, item, unidade), com quantidade normalizada
    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      SELECT sub.funcao, sub.item, MAX(sub.quantidade)::int AS quantidade, sub.unidade
      FROM (
        SELECT
          ${funcaoSel} AS funcao,
          TRIM(COALESCE(m.epi_item, '')) AS item,
          GREATEST(1, ROUND(COALESCE(NULLIF(TRIM(m.quantidade::text), '')::numeric, 1)))::int AS quantidade,
          ${unidadeSel} AS unidade
        FROM stg_epi_map m
        ${whereSql}
      ) sub
      WHERE sub.funcao != '' AND sub.item != '' AND UPPER(sub.item) != 'SEM EPI'
      GROUP BY sub.funcao, sub.item, sub.unidade
      ORDER BY sub.funcao, sub.item
      LIMIT ${size} OFFSET ${offset}
      `,
      ...params,
    );

    // Total: conta grupos distintos (função, item, unidade)
    const totalRes: any[] = await prisma.$queryRawUnsafe(
      `
      SELECT COUNT(*)::int AS c
      FROM (
        SELECT 1
        FROM (
          SELECT ${funcaoSel} AS funcao, TRIM(COALESCE(m.epi_item, '')) AS item, ${unidadeSel} AS unidade
          FROM stg_epi_map m
          ${whereSql}
        ) sub
        WHERE sub.funcao != '' AND sub.item != '' AND UPPER(sub.item) != 'SEM EPI'
        GROUP BY sub.funcao, sub.item, sub.unidade
      ) g
      `,
      ...params,
    );

    const total: number = totalRes?.[0]?.c ?? rows.length;

    return NextResponse.json({ rows, total });
  } catch (err: any) {
    console.error('Error in /api/kits/map', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao carregar mapa de kits.' },
      { status: 500 },
    );
  }
}
