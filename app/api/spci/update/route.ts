import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseDateBR, formatDateBR, getMesBR, parsePossuiContrato, formatPossuiContrato } from '@/lib/spci/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Atualiza um registro do SPCI
 * Campos editáveis: Planej. Recarga, Data Execução Recarga, Possui Contrato
 * 
 * REGRA CRÍTICA:
 * - Se Data Execução Recarga for informada, atualiza automaticamente "Última recarga"
 * - Mês Planej Recarga e Mês Exec Recarga são calculados automaticamente
 * - Status e Data Limite NUNCA são salvos (sempre calculados)
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    // Campos permitidos para edição
    const allowedFields: Record<string, any> = {};
    
    if ('tag' in updates && updates.tag !== undefined) {
      allowedFields['TAG'] = updates.tag || null;
    }
    
    if ('unidade' in updates && updates.unidade !== undefined) {
      allowedFields['Unidade'] = updates.unidade || null;
    }
    
    if ('regional' in updates && updates.regional !== undefined) {
      allowedFields['Regional'] = updates.regional || null;
    }
    
    if ('local' in updates && updates.local !== undefined) {
      allowedFields['Local'] = updates.local || null;
    }
    
    if ('classe' in updates && updates.classe !== undefined) {
      allowedFields['Classe'] = updates.classe || null;
    }
    
    if ('massaVolume' in updates && updates.massaVolume !== undefined) {
      allowedFields['Massa/Volume (kg/L)'] = updates.massaVolume || null;
    }
    
    if ('planejRecarga' in updates) {
      allowedFields['Planej. Recarga'] = updates.planejRecarga || null;
      // Calcula mês automaticamente
      if (updates.planejRecarga) {
        const date = parseDateBR(updates.planejRecarga);
        allowedFields['Mês Planej Recarga'] = date ? getMesBR(date) : null;
      } else {
        allowedFields['Mês Planej Recarga'] = null;
      }
    }

    if ('dataExecucaoRecarga' in updates) {
      const dataExec = updates.dataExecucaoRecarga;
      allowedFields['Data Execução Recarga'] = dataExec || null;
      
      // Calcula mês automaticamente
      if (dataExec) {
        const date = parseDateBR(dataExec);
        allowedFields['Mês Exec Recarga'] = date ? getMesBR(date) : null;
        
        // REGRA CRÍTICA: Se Data Execução foi informada, atualiza "Última recarga"
        allowedFields['Última recarga'] = formatDateBR(date!);
      } else {
        allowedFields['Mês Exec Recarga'] = null;
      }
    }

    if ('possuiContrato' in updates) {
      allowedFields['Possui Contrato'] = formatPossuiContrato(updates.possuiContrato);
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Nenhum campo válido para atualizar' },
        { status: 400 }
      );
    }

    // Constrói SQL de UPDATE
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(allowedFields)) {
      setClauses.push(`"${key}" = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    // Usa id (minúsculo, bigint) como identificador
    const whereClause = `id = $${paramIndex}`;
    params.push(id); // id no final para WHERE

    const updateSql = `
      UPDATE spci_planilha
      SET ${setClauses.join(', ')}
      WHERE ${whereClause}
      RETURNING 
        id,
        "TAG",
        "Unidade",
        "Regional",
        "Última recarga",
        "Planej. Recarga",
        "Mês Planej Recarga",
        "Data Execução Recarga",
        "Mês Exec Recarga",
        "Possui Contrato"
    `;

    const result = await prisma.$queryRawUnsafe<any[]>(updateSql, ...params);

    if (!result || result.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Registro não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: result[0],
      message: 'Registro atualizado com sucesso',
    });
  } catch (error: any) {
    console.error('spci/update error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao atualizar registro' },
      { status: 500 }
    );
  }
}
