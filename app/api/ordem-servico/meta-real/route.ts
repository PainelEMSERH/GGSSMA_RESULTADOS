import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * API para Meta e Real de Ordem de Serviço
 * 
 * META = quantidade acumulada de colaboradores que DEVERIAM ter recebido a OS até cada mês
 *        Baseado na data de admissão (01/01/2026)
 *        Meta acumulada: Jan tem os que iniciaram em jan, Fev tem jan+fev, etc.
 *        Como todos iniciam em 01/01/2026, a meta é a mesma para todos os meses
 * 
 * REAL = quantidade acumulada de colaboradores que REALMENTE receberam a OS até cada mês
 *        Baseado no campo "data_entrega" da tabela ordem_servico
 *        Real acumulado: Jan tem os entregues em jan, Fev tem jan+fev, Mar tem jan+fev+mar, etc.
 */
export async function GET(req: NextRequest) {
  try {
    // Garante que a tabela ordem_servico existe
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ordem_servico (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        colaborador_cpf TEXT NOT NULL,
        entregue BOOLEAN NOT NULL DEFAULT false,
        data_entrega DATE,
        responsavel TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(colaborador_cpf)
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_colaborador_cpf ON ordem_servico(colaborador_cpf);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_data_entrega ON ordem_servico(data_entrega);
    `);

    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const ano = url.searchParams.get('ano') || String(new Date().getFullYear());

    const anoAtual = parseInt(ano, 10);
    const DEMISSAO_LIMITE = '2026-01-01';

    // Monta condições WHERE
    // Colaboradores ativos em 2026: admitidos em qualquer data, mas não demitidos antes de 2026
    let whereConditions: string[] = [];
    
    // Filtro de demissão: EXATAMENTE como entregas
    // Remove apenas demitidos antes de 2026-01-01
    whereConditions.push(`(a.demissao IS NULL OR a.demissao = '' OR TRIM(a.demissao) = '' OR a.demissao::text >= '${DEMISSAO_LIMITE}')`);

    if (regional) {
      whereConditions.push(`COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                        WHERE ur.nmdepartamento = a.unidade_hospitalar 
                        LIMIT 1),'') = '${regional.replace(/'/g, "''")}'`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Total de colaboradores ativos em 2026 (META)
    // Meta = todos os colaboradores que estavam ativos no início de 2026
    // (admitidos em qualquer data, mas não demitidos antes de 2026)
    // EXATAMENTE como entregas: filtra CPF e função não vazios
    const totalMetaQuery = `
      SELECT COUNT(*) as total
      FROM stg_alterdata_v2 a
      ${whereClause}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    `;
    const totalMetaResult: any[] = await prisma.$queryRawUnsafe(totalMetaQuery);
    const totalMeta = parseInt(totalMetaResult[0]?.total || '0', 10);

    // Meta acumulada por mês (todos os meses têm a mesma meta, pois são todos os ativos em 2026)
    const metaAcumulada: Record<string, number> = {
      '01': totalMeta, '02': totalMeta, '03': totalMeta, '04': totalMeta,
      '05': totalMeta, '06': totalMeta, '07': totalMeta, '08': totalMeta,
      '09': totalMeta, '10': totalMeta, '11': totalMeta, '12': totalMeta,
    };

    // Real: quantidade de OS entregues por mês
    const realMeses: Record<string, number> = {
      '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
      '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0,
    };

    // Busca entregas de OS por mês (apenas de colaboradores não demitidos antes de 2026)
    const realQuery = `
      SELECT 
        EXTRACT(MONTH FROM os.data_entrega)::int as mes,
        COUNT(*) as total
      FROM ordem_servico os
      INNER JOIN stg_alterdata_v2 a ON a.cpf = os.colaborador_cpf
      WHERE os.entregue = true
        AND EXTRACT(YEAR FROM os.data_entrega) = ${anoAtual}
        AND (a.demissao IS NULL OR a.demissao = '' OR TRIM(a.demissao) = '' OR a.demissao::text >= '${DEMISSAO_LIMITE}')
        ${regional ? `AND COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                        WHERE ur.nmdepartamento = a.unidade_hospitalar 
                        LIMIT 1),'') = '${regional.replace(/'/g, "''")}'` : ''}
      GROUP BY EXTRACT(MONTH FROM os.data_entrega)
      ORDER BY mes
    `;

    const realResult: any[] = await prisma.$queryRawUnsafe(realQuery);
    realResult.forEach((r) => {
      const mes = String(r.mes).padStart(2, '0');
      if (realMeses[mes] !== undefined) {
        realMeses[mes] = parseInt(r.total || '0', 10);
      }
    });

    // Calcula REAL acumulado mês a mês
    const realAcumulado: Record<string, number> = {
      '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
      '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0,
    };
    let acumuladoReal = 0;
    for (let mes = 1; mes <= 12; mes++) {
      const mesStr = String(mes).padStart(2, '0');
      acumuladoReal += realMeses[mesStr] || 0;
      realAcumulado[mesStr] = acumuladoReal;
    }

    const totalReal = acumuladoReal;

    return NextResponse.json({
      ok: true,
      meta: metaAcumulada,
      metaMensal: metaAcumulada, // Mesma coisa, pois todos iniciaram no mesmo dia
      real: realMeses,
      realAcumulado: realAcumulado,
      totalColaboradores: totalMeta,
      totalMeta: totalMeta,
      totalReal: totalReal,
      ano: anoAtual,
    });
  } catch (e: any) {
    console.error('[ordem-servico/meta-real] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
