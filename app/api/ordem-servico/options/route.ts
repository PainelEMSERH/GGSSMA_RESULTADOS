import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { UNID_TO_REGIONAL } from '@/lib/unidReg';

/**
 * API para buscar opções de filtros (regionais, unidades)
 * Usa a mesma estrutura da página de entregas
 */
export async function GET(req: NextRequest) {
  try {
    // Verifica se stg_unid_reg existe
    const hasUnidRegCheck: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `);
    const useJoin = hasUnidRegCheck?.[0]?.exists;

    let regionais: string[] = [];
    let unidades: Array<{ unidade: string; regional: string }> = [];

    if (useJoin) {
      // Busca regionais e unidades de stg_unid_reg (mesma lógica da página de entregas)
      const regionaisQuery = `
        SELECT DISTINCT
          COALESCE(ur.regional_responsavel, '') as regional
        FROM stg_unid_reg ur
        WHERE COALESCE(ur.regional_responsavel, '') != ''
        ORDER BY regional
      `;

      const unidadesQuery = `
        SELECT DISTINCT
          COALESCE(ur.nmddepartamento, ur.nmd_departamento, '') as unidade,
          COALESCE(ur.regional_responsavel, '') as regional
        FROM stg_unid_reg ur
        WHERE COALESCE(ur.nmddepartamento, ur.nmd_departamento, '') != ''
        ORDER BY regional, unidade
      `;

      const regionaisResult: any[] = await prisma.$queryRawUnsafe(regionaisQuery);
      const unidadesResult: any[] = await prisma.$queryRawUnsafe(unidadesQuery);

      regionais = regionaisResult
        .map((r) => r.regional)
        .filter((r) => r && r.trim() !== '')
        .sort();

      unidades = unidadesResult
        .map((r) => ({
          unidade: r.unidade,
          regional: r.regional || '',
        }))
        .filter((u) => u.unidade && u.unidade.trim() !== '');
    } else {
      // Fallback: busca unidades de stg_alterdata_v2
      const unidadesQuery = `
        SELECT DISTINCT
          COALESCE(a.unidade_hospitalar, '') as unidade
        FROM stg_alterdata_v2 a
        WHERE COALESCE(a.unidade_hospitalar, '') != ''
        ORDER BY unidade
      `;

      const unidadesResult: any[] = await prisma.$queryRawUnsafe(unidadesQuery);
      unidades = unidadesResult
        .map((r) => ({
          unidade: r.unidade,
          regional: '',
        }))
        .filter((u) => u.unidade && u.unidade.trim() !== '');

      // Usa mapeamento estático para regionais
      const regionaisSet = new Set<string>();
      unidades.forEach((u) => {
        const reg = UNID_TO_REGIONAL[u.unidade.toUpperCase()];
        if (reg) {
          const regFormatted = reg.charAt(0) + reg.slice(1).toLowerCase();
          regionaisSet.add(regFormatted);
        }
      });
      regionais = Array.from(regionaisSet).sort();
    }

    return NextResponse.json({
      ok: true,
      regionais,
      unidades,
    });
  } catch (e: any) {
    console.error('[ordem-servico/options] error', e);
    // Fallback: usa mapeamento estático
    const unidades: Array<{ unidade: string; regional: string }> = Object.entries(UNID_TO_REGIONAL).map(
      ([unidade, regionalUpper]) => {
        const regional = regionalUpper.charAt(0) + regionalUpper.slice(1).toLowerCase();
        return { unidade, regional };
      }
    );

    const regionais = Array.from(
      new Set(unidades.map((u) => u.regional).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    unidades.sort((a, b) => a.unidade.localeCompare(b.unidade));

    return NextResponse.json({
      ok: true,
      regionais,
      unidades,
    });
  }
}
