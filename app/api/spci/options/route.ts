import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAllUnidades } from '@/lib/spci/unidadeNormalizer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Retorna opções únicas para os filtros
 */
export async function GET() {
  try {
    // Busca valores únicos de cada campo
    const [regionaisRes, unidadesRes, classesRes, anosRes] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT DISTINCT "Regional" FROM spci_planilha WHERE "Regional" IS NOT NULL AND "Regional" != '' ORDER BY "Regional"`
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT DISTINCT "Unidade" FROM spci_planilha WHERE "Unidade" IS NOT NULL AND "Unidade" != '' ORDER BY "Unidade"`
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT DISTINCT "Classe" FROM spci_planilha WHERE "Classe" IS NOT NULL AND "Classe" != '' ORDER BY "Classe"`
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT DISTINCT "Ano do Planejamento" FROM spci_planilha WHERE "Ano do Planejamento" IS NOT NULL ORDER BY "Ano do Planejamento" DESC`
      ),
    ]);

    const regionais = regionaisRes.map((r: any) => r.Regional || r['Regional'] || r).filter(Boolean);
    
    // Para unidades, usa as do banco mas também inclui as normalizadas conhecidas
    const unidadesDB = unidadesRes.map((u: any) => u.Unidade || u['Unidade'] || u).filter(Boolean);
    const unidadesKnown = getAllUnidades();
    // Combina e remove duplicatas (normalizando)
    const unidadesSet = new Set<string>();
    [...unidadesDB, ...unidadesKnown].forEach(u => {
      if (u) unidadesSet.add(u);
    });
    const unidades = Array.from(unidadesSet).sort();
    
    const classes = classesRes.map((c: any) => c.Classe || c['Classe'] || c).filter(Boolean);
    const anos = anosRes.map((a: any) => a['Ano do Planejamento'] || a).filter(Boolean);

    return NextResponse.json({
      ok: true,
      regionais,
      unidades,
      classes,
      anos,
    });
  } catch (error: any) {
    console.error('spci/options error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao buscar opções' },
      { status: 500 }
    );
  }
}
