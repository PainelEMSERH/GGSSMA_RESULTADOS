export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isEpiObrigatorio } from '@/data/epiObrigatorio';

/**
 * Calcula a meta de EPIs obrigatórios por regional
 * Meta = soma de todos os EPIs obrigatórios dos colaboradores ativos da regional
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const unidade = url.searchParams.get('unidade') || '';

    if (!regional) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Regional é obrigatória',
        meta: 0 
      });
    }

    // Busca colaboradores ativos da regional/unidade
    const wh: string[] = [];
    const regTrim = regional.trim();
    const uniTrim = unidade.trim();

    // Verifica se stg_unid_reg existe
    const hasUnidReg: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `);
    const useJoin = hasUnidReg?.[0]?.exists;

    if (regTrim && useJoin) {
      wh.push(`(UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${regTrim.replace(/'/g, "''")}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
        SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${regTrim.replace(/'/g, "''")}'))
      ))`);
    }
    
    if (uniTrim) {
      if (useJoin) {
        wh.push(`(UPPER(TRIM(COALESCE(u.nmdepartamento, a.unidade_hospitalar, ''))) = UPPER(TRIM('${uniTrim.replace(/'/g, "''")}')) OR UPPER(TRIM(a.unidade_hospitalar)) = UPPER(TRIM('${uniTrim.replace(/'/g, "''")}')))`);
      } else {
        wh.push(`UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${uniTrim.replace(/'/g, "''")}'))`);
      }
    }

    // Filtro de demissão: apenas demitidos antes de 2026-01-01 são removidos
    const DEMISSAO_LIMITE = '2026-01-01';
    wh.push(`(a.demissao IS NULL OR a.demissao = '' OR TRIM(a.demissao) = '' OR a.demissao::text >= '${DEMISSAO_LIMITE}')`);

    const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';

    // Busca colaboradores e seus kits esperados
    const sql = useJoin ? `
      SELECT DISTINCT
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.funcao, '') AS funcao
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      ${whereSql}
    ` : `
      SELECT DISTINCT
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.funcao, '') AS funcao
      FROM stg_alterdata_v2 a
      ${whereSql}
    `;

    const colaboradores = await prisma.$queryRawUnsafe<any[]>(sql);

    // Busca kits esperados por função (apenas EPIs obrigatórios)
    let totalMeta = 0;
    const kitMap: Record<string, number> = {};

    try {
      const kitRows = await prisma.$queryRaw<any[]>`
        SELECT
          COALESCE(cpf::text, '') AS cpf,
          COALESCE(epi_nome::text, '') AS item,
          COALESCE(quantidade::numeric, 0) AS qtd
        FROM vw_entregas_epi_unidade
      `;

      for (const r of kitRows) {
        const item = String(r.item || '').trim();
        if (!item || !isEpiObrigatorio(item)) continue; // Apenas obrigatórios
        
        const qtd = Number(r.qtd || 0) || 0;
        kitMap[item] = (kitMap[item] || 0) + qtd;
      }

      // Para cada colaborador, soma os EPIs obrigatórios do seu kit
      for (const colab of colaboradores) {
        const cpf = String(colab.cpf || '').replace(/\D/g, '').slice(-11);
        if (!cpf) continue;

        // Busca kit do colaborador
        const kitColab = kitRows.filter((r: any) => {
          const rCpf = String(r.cpf || '').replace(/\D/g, '').slice(-11);
          return rCpf === cpf && isEpiObrigatorio(String(r.item || '').trim());
        });

        // Soma quantidade de EPIs obrigatórios
        for (const item of kitColab) {
          totalMeta += Number(item.qtd || 0);
        }
      }
    } catch (kitError) {
      console.error('Erro ao buscar kits:', kitError);
      // Se não conseguir buscar kits, retorna 0
    }

    return NextResponse.json({
      ok: true,
      meta: totalMeta,
      colaboradores: colaboradores.length,
      regional: regTrim,
      unidade: uniTrim || null,
    });
  } catch (e: any) {
    console.error('Erro ao calcular meta:', e);
    return NextResponse.json({
      ok: false,
      error: String(e?.message || e),
      meta: 0,
    });
  }
}
