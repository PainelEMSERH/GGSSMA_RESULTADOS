import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { compute2026From2025 } from '@/lib/cipa/compute-2026';

/**
 * Meta vs Real CIPA: por mês, quantas atividades estavam previstas (data_fim_prevista)
 * e quantas foram concluídas (data_conclusao). Meta = % acumulada por mês conforme as datas.
 */
export async function GET(req: NextRequest) {
  try {
    const hasTable: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'cronograma_cipa'
      ) AS exists
    `);
    if (!hasTable?.[0]?.exists) {
      return NextResponse.json({
        ok: true,
        meta: {},
        realAcumulado: {},
        totalMeta: 0,
        totalReal: 0,
        ano: parseInt(new URL(req.url).searchParams.get('ano') || '2025', 10),
      });
    }

    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const ano = parseInt(url.searchParams.get('ano') || '2025', 10);

    const wh: string[] = [`ano_gestao = ${ano}`];
    if (regional) wh.push(`TRIM(regional) = '${String(regional).replace(/'/g, "''")}'`);
    const whereSql = `WHERE ${wh.join(' AND ')}`;

    // Total de atividades (meta = quantidade de ações a serem feitas)
    let totalMeta = 0;
    let metaMeses: Record<string, number> = {};
    let realMeses: Record<string, number> = {};
    let totalReal = 0;

    const totalMetaResult: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total FROM cronograma_cipa ${whereSql}
    `);
    totalMeta = Number(totalMetaResult[0]?.total ?? 0);

    // 2026 sem dados no banco: usar dados calculados a partir de 2025 para exibir a meta
    if (ano === 2026 && totalMeta === 0) {
      const rows2026 = await compute2026From2025(prisma, regional, '');
      totalMeta = rows2026.length;
      totalReal = 0;
      for (let m = 1; m <= 12; m++) {
        const mesStr = String(m).padStart(2, '0');
        const lastDay = new Date(ano, m, 0);
        const lastDayStr = `${ano}-${String(m).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
        metaMeses[mesStr] = rows2026.filter((r) => r.data_fim_prevista && r.data_fim_prevista <= lastDayStr).length;
        realMeses[mesStr] = 0;
      }
    } else {
      // Total concluídas (data_conclusao preenchida). Para 2026, sempre 0.
      const totalRealResult: any[] = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS total FROM cronograma_cipa ${whereSql} 
        AND data_conclusao IS NOT NULL 
        ${ano === 2026 ? 'AND FALSE' : ''}
      `);
      totalReal = Number(totalRealResult[0]?.total ?? 0);

      // Meta por mês: atividades cuja data_fim_prevista cai até o fim do mês (acumulado)
      for (let m = 1; m <= 12; m++) {
        const mesStr = String(m).padStart(2, '0');
        const lastDay = new Date(ano, m, 0);
        const lastDayStr = `${ano}-${String(m).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
        const anoFilter = ano === 2026 ? `AND EXTRACT(YEAR FROM data_fim_prevista::date) = 2026` : '';
        const r: any[] = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*)::int AS total FROM cronograma_cipa
          ${whereSql}
          AND data_fim_prevista::date <= '${lastDayStr}'::date
          ${anoFilter}
        `);
        metaMeses[mesStr] = Number(r[0]?.total ?? 0);
      }

      // Real por mês: atividades com data_conclusao até o fim do mês (acumulado)
      for (let m = 1; m <= 12; m++) {
        const mesStr = String(m).padStart(2, '0');
        const lastDay = new Date(ano, m, 0);
        const lastDayStr = `${ano}-${String(m).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
        const r: any[] = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*)::int AS total FROM cronograma_cipa
          ${whereSql}
          AND data_conclusao IS NOT NULL AND data_conclusao::date <= '${lastDayStr}'::date
          ${ano === 2026 ? 'AND FALSE' : ''}
        `);
        realMeses[mesStr] = Number(r[0]?.total ?? 0);
      }
    }

    const meses = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const meta: Record<string, number> = {};
    const realAcumulado: Record<string, number> = {};
    const metaPercent: Record<string, number> = {};
    const realPercent: Record<string, number> = {};
    const evolucaoMensal: Record<string, number> = {};
    
    let realAnterior = 0;
    meses.forEach((mes) => {
      const metaVal = metaMeses[mes] ?? 0;
      const realVal = realMeses[mes] ?? 0;
      meta[mes] = metaVal;
      realAcumulado[mes] = realVal;
      
      // Porcentagem: (valor acumulado / total meta) * 100
      metaPercent[mes] = totalMeta > 0 ? Math.round((metaVal / totalMeta) * 100) : 0;
      realPercent[mes] = totalMeta > 0 ? Math.round((realVal / totalMeta) * 100) : 0;
      
      // Evolução mês a mês: diferença de porcentagem entre este mês e o anterior
      evolucaoMensal[mes] = realPercent[mes] - (totalMeta > 0 ? Math.round((realAnterior / totalMeta) * 100) : 0);
      realAnterior = realVal;
    });

    // Porcentagem total de conclusão
    const percentTotal = totalMeta > 0 ? Math.round((totalReal / totalMeta) * 100) : 0;

    return NextResponse.json({
      ok: true,
      meta,
      realAcumulado,
      metaPercent,
      realPercent,
      evolucaoMensal,
      totalMeta,
      totalReal,
      percentTotal,
      ano,
    });
  } catch (e: any) {
    console.error('[cipa/meta-real] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
