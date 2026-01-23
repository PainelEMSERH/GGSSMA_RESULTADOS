export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { REPORT_MODULES, ReportFilters, ReportColumn } from '@/lib/relatorios/config';
import { isEpiObrigatorio } from '@/data/epiObrigatorio';

// Função para buscar dados de Entregas
async function fetchEntregasData(filters: ReportFilters, selectedColumns: string[]): Promise<any[]> {
  const { regional, unidade, de, ate } = filters;
  
  const now = new Date();
  const defaultAte = ate || now.toISOString().slice(0, 10);
  const defaultDeDate = de ? new Date(de) : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const defaultDe = de || defaultDeDate.toISOString().slice(0, 10);

  const where: string[] = [];
  const params: any[] = [];

  params.push(defaultDe);
  where.push(`j.data >= $${params.length}`);
  params.push(defaultAte);
  where.push(`j.data <= $${params.length}`);

  if (regional) {
    params.push(regional.toUpperCase());
    where.push(`upper(coalesce(j.regional, '')) = $${params.length}`);
  }

  if (unidade) {
    params.push(unidade.toUpperCase());
    where.push(`upper(coalesce(j.unidade, '')) = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `
    WITH base AS (
      SELECT
        e.cpf,
        e.item,
        (elem->>'date')::date AS data,
        (elem->>'qty')::int AS quantidade,
        e.qty_required,
        e.qty_delivered
      FROM epi_entregas e
      CROSS JOIN LATERAL jsonb_array_elements(e.deliveries) elem
    ),
    joined AS (
      SELECT
        b.cpf,
        b.item,
        b.data,
        b.quantidade,
        b.qty_required,
        b.qty_delivered,
        COALESCE(f.regional, m.regional, '—') AS regional,
        COALESCE(f.unidade, m.unidade, '—') AS unidade,
        COALESCE(f.nome, m.nome, '—') AS nome,
        COALESCE(f.matricula, m.matricula, '—') AS matricula,
        COALESCE(f.funcao, m.funcao, '—') AS funcao,
        COALESCE(f.admissao, m.admissao::text, null) AS admissao,
        COALESCE(f.demissao, m.demissao::text, null) AS demissao
      FROM base b
      LEFT JOIN mv_alterdata_flat f ON f.cpf = b.cpf
      LEFT JOIN epi_manual_colab m ON m.cpf = b.cpf
    )
    SELECT * FROM joined j
    ${whereSql}
    ORDER BY j.data DESC, j.nome, j.item
  `;

  const rows: any[] = await prisma.$queryRawUnsafe<any[]>(sql, ...params);

  return rows.map((r) => {
    const row: any = {};
    
    if (selectedColumns.includes('cpf')) row.cpf = String(r.cpf || '');
    if (selectedColumns.includes('nome')) row.nome = String(r.nome || '—');
    if (selectedColumns.includes('matricula')) row.matricula = String(r.matricula || '—');
    if (selectedColumns.includes('funcao')) row.funcao = String(r.funcao || '—');
    if (selectedColumns.includes('unidade')) row.unidade = String(r.unidade || '—');
    if (selectedColumns.includes('regional')) row.regional = String(r.regional || '—');
    if (selectedColumns.includes('item')) row.item = String(r.item || '');
    if (selectedColumns.includes('quantidade')) row.quantidade = Number(r.quantidade || 0);
    if (selectedColumns.includes('data_entrega')) row.data_entrega = r.data ? new Date(r.data).toISOString().slice(0, 10) : null;
    if (selectedColumns.includes('qty_required')) row.qty_required = Number(r.qty_required || 0);
    if (selectedColumns.includes('qty_delivered')) row.qty_delivered = Number(r.qty_delivered || 0);
    if (selectedColumns.includes('admissao')) row.admissao = r.admissao ? String(r.admissao).slice(0, 10) : null;
    if (selectedColumns.includes('demissao')) row.demissao = r.demissao ? String(r.demissao).slice(0, 10) : null;
    if (selectedColumns.includes('obrigatorio')) row.obrigatorio = isEpiObrigatorio(r.item) ? 'Sim' : 'Não';
    
    return row;
  });
}

// Função para buscar dados de SPCI
async function fetchSPCIData(filters: ReportFilters, selectedColumns: string[]): Promise<any[]> {
  const { regional, unidade, de, ate } = filters;
  
  const where: string[] = [];
  const params: any[] = [];
  
  if (de) {
    params.push(de);
    where.push(`data_vencimento >= $${params.length}::date`);
  }
  if (ate) {
    params.push(ate);
    where.push(`data_vencimento <= $${params.length}::date`);
  }
  if (regional) {
    params.push(regional.toUpperCase());
    where.push(`upper(coalesce(regional, '')) = $${params.length}`);
  }
  if (unidade) {
    params.push(unidade.toUpperCase());
    where.push(`upper(coalesce(unidade, '')) = $${params.length}`);
  }
  
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  
  const sql = `SELECT * FROM stg_spci ${whereSql} ORDER BY unidade, localizacao`;
  
  try {
    const rows: any[] = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows.map((r) => {
      const row: any = {};
      if (selectedColumns.includes('unidade')) row.unidade = String(r.unidade || '—');
      if (selectedColumns.includes('regional')) row.regional = String(r.regional || '—');
      if (selectedColumns.includes('tipo_extintor')) row.tipo_extintor = String(r.tipo_extintor || '');
      if (selectedColumns.includes('capacidade')) row.capacidade = String(r.capacidade || '');
      if (selectedColumns.includes('localizacao')) row.localizacao = String(r.localizacao || '');
      if (selectedColumns.includes('data_vencimento')) row.data_vencimento = r.data_vencimento ? new Date(r.data_vencimento).toISOString().slice(0, 10) : null;
      if (selectedColumns.includes('ultima_inspecao')) row.ultima_inspecao = r.ultima_inspecao ? new Date(r.ultima_inspecao).toISOString().slice(0, 10) : null;
      if (selectedColumns.includes('proxima_inspecao')) row.proxima_inspecao = r.proxima_inspecao ? new Date(r.proxima_inspecao).toISOString().slice(0, 10) : null;
      if (selectedColumns.includes('status')) row.status = String(r.status || '');
      return row;
    });
  } catch {
    return [];
  }
}

// Função para buscar dados de CIPA
async function fetchCIPAData(filters: ReportFilters, selectedColumns: string[]): Promise<any[]> {
  const { regional, unidade } = filters;
  
  const where: string[] = [];
  const params: any[] = [];
  
  if (regional) {
    params.push(regional.toUpperCase());
    where.push(`upper(coalesce(unidade, '')) IN (
      SELECT upper(coalesce(nmdepartamento, '')) 
      FROM stg_unid_reg 
      WHERE upper(coalesce(regional_responsavel, '')) = $${params.length}
    )`);
  }
  if (unidade) {
    params.push(unidade.toUpperCase());
    where.push(`upper(coalesce(unidade, '')) = $${params.length}`);
  }
  
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  
  const sql = `SELECT * FROM stg_cipa ${whereSql} ORDER BY unidade, nome`;
  
  try {
    const rows: any[] = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows.map((r) => {
      const row: any = {};
      if (selectedColumns.includes('nome')) row.nome = String(r.nome || '');
      if (selectedColumns.includes('cpf')) row.cpf = String(r.cpf || '');
      if (selectedColumns.includes('funcao')) row.funcao = String(r.funcao || '');
      if (selectedColumns.includes('unidade')) row.unidade = String(r.unidade || '');
      if (selectedColumns.includes('cargo_cipa')) row.cargo_cipa = String(r.cargo_cipa || '');
      if (selectedColumns.includes('data_eleicao')) row.data_eleicao = r.data_eleicao ? new Date(r.data_eleicao).toISOString().slice(0, 10) : null;
      if (selectedColumns.includes('data_fim_mandato')) row.data_fim_mandato = r.data_fim_mandato ? new Date(r.data_fim_mandato).toISOString().slice(0, 10) : null;
      if (selectedColumns.includes('status')) row.status = String(r.status || '');
      return row;
    });
  } catch {
    return [];
  }
}

// Função para buscar dados de Acidentes
async function fetchAcidentesData(filters: ReportFilters, selectedColumns: string[]): Promise<any[]> {
  const { regional, unidade, de, ate } = filters;
  
  const where: string[] = [];
  const params: any[] = [];
  
  if (de) {
    params.push(de);
    where.push(`data_acidente >= $${params.length}::date`);
  }
  if (ate) {
    params.push(ate);
    where.push(`data_acidente <= $${params.length}::date`);
  }
  if (regional) {
    params.push(regional.toUpperCase());
    where.push(`upper(coalesce(unidade, '')) IN (
      SELECT upper(coalesce(nmdepartamento, '')) 
      FROM stg_unid_reg 
      WHERE upper(coalesce(regional_responsavel, '')) = $${params.length}
    )`);
  }
  if (unidade) {
    params.push(unidade.toUpperCase());
    where.push(`upper(coalesce(unidade, '')) = $${params.length}`);
  }
  
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  
  const sql = `SELECT * FROM stg_acidentes ${whereSql} ORDER BY data_acidente DESC, nome`;
  
  try {
    const rows: any[] = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows.map((r) => {
      const row: any = {};
      if (selectedColumns.includes('data_acidente')) row.data_acidente = r.data_acidente ? new Date(r.data_acidente).toISOString().slice(0, 10) : null;
      if (selectedColumns.includes('nome')) row.nome = String(r.nome || '');
      if (selectedColumns.includes('cpf')) row.cpf = String(r.cpf || '');
      if (selectedColumns.includes('funcao')) row.funcao = String(r.funcao || '');
      if (selectedColumns.includes('unidade')) row.unidade = String(r.unidade || '');
      if (selectedColumns.includes('tipo_acidente')) row.tipo_acidente = String(r.tipo_acidente || '');
      if (selectedColumns.includes('gravidade')) row.gravidade = String(r.gravidade || '');
      if (selectedColumns.includes('descricao')) row.descricao = String(r.descricao || '');
      if (selectedColumns.includes('causa')) row.causa = String(r.causa || '');
      if (selectedColumns.includes('medidas_corretivas')) row.medidas_corretivas = String(r.medidas_corretivas || '');
      return row;
    });
  } catch {
    return [];
  }
}

// Função para buscar dados de Ordens de Serviço
async function fetchOrdensServicoData(filters: ReportFilters, selectedColumns: string[]): Promise<any[]> {
  const { regional, unidade, de, ate } = filters;
  
  const where: string[] = [];
  const params: any[] = [];
  
  if (de) {
    params.push(de);
    where.push(`data_abertura >= $${params.length}::date`);
  }
  if (ate) {
    params.push(ate);
    where.push(`data_abertura <= $${params.length}::date`);
  }
  if (regional) {
    params.push(regional.toUpperCase());
    where.push(`upper(coalesce(regional, '')) = $${params.length}`);
  }
  if (unidade) {
    params.push(unidade.toUpperCase());
    where.push(`upper(coalesce(unidade, '')) = $${params.length}`);
  }
  
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  
  const sql = `SELECT * FROM stg_ordens_servico ${whereSql} ORDER BY data_abertura DESC, numero`;
  
  try {
    const rows: any[] = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows.map((r) => {
      const row: any = {};
      if (selectedColumns.includes('numero')) row.numero = String(r.numero || '');
      if (selectedColumns.includes('data_abertura')) row.data_abertura = r.data_abertura ? new Date(r.data_abertura).toISOString().slice(0, 10) : null;
      if (selectedColumns.includes('data_fechamento')) row.data_fechamento = r.data_fechamento ? new Date(r.data_fechamento).toISOString().slice(0, 10) : null;
      if (selectedColumns.includes('unidade')) row.unidade = String(r.unidade || '');
      if (selectedColumns.includes('regional')) row.regional = String(r.regional || '');
      if (selectedColumns.includes('tipo_servico')) row.tipo_servico = String(r.tipo_servico || '');
      if (selectedColumns.includes('descricao')) row.descricao = String(r.descricao || '');
      if (selectedColumns.includes('solicitante')) row.solicitante = String(r.solicitante || '');
      if (selectedColumns.includes('status')) row.status = String(r.status || '');
      if (selectedColumns.includes('prioridade')) row.prioridade = String(r.prioridade || '');
      return row;
    });
  } catch {
    return [];
  }
}

const FETCH_FUNCTIONS: Record<string, (filters: ReportFilters, columns: string[]) => Promise<any[]>> = {
  entregas: fetchEntregasData,
  spci: fetchSPCIData,
  cipa: fetchCIPAData,
  acidentes: fetchAcidentesData,
  ordens_servico: fetchOrdensServicoData,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modules, filters } = body as {
      modules: Array<{ id: string; selectedColumns: string[] }>;
      filters: ReportFilters;
    };

    if (!modules || !Array.isArray(modules) || modules.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhum módulo selecionado' }, { status: 400 });
    }

    // Valida módulos
    const validModules = modules.filter(m => {
      const moduleConfig = REPORT_MODULES.find(mod => mod.id === m.id);
      return moduleConfig && moduleConfig.enabled && FETCH_FUNCTIONS[m.id];
    });

    if (validModules.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhum módulo válido selecionado' }, { status: 400 });
    }

    // Busca dados de cada módulo
    const sheets: Array<{ name: string; data: any[]; columns: ReportColumn[] }> = [];

    for (const module of validModules) {
      const moduleConfig = REPORT_MODULES.find(m => m.id === module.id);
      if (!moduleConfig) continue;

      const fetchFn = FETCH_FUNCTIONS[module.id];
      if (!fetchFn) continue;

      const data = await fetchFn(filters, module.selectedColumns);
      
      // Filtra apenas as colunas selecionadas
      const selectedCols = moduleConfig.columns.filter(col => 
        module.selectedColumns.includes(col.id)
      );

      sheets.push({
        name: moduleConfig.name,
        data,
        columns: selectedCols,
      });
    }

    // Gera Excel
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();

    for (const sheet of sheets) {
      if (sheet.data.length === 0) {
        // Cria aba vazia com cabeçalhos
        const headers = sheet.columns.map(col => col.label);
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        
        // Ajusta larguras
        const colWidths = sheet.columns.map(col => ({ wch: col.width || 15 }));
        ws['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(workbook, ws, sheet.name.substring(0, 31)); // Excel limita nome a 31 chars
      } else {
        // Prepara dados com cabeçalhos
        const headers = sheet.columns.map(col => col.label);
        const rows = sheet.data.map(row => 
          sheet.columns.map(col => {
            const value = row[col.id];
            if (col.type === 'date' && value) {
              // Formata data para Excel
              return value;
            }
            return value ?? '';
          })
        );

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        
        // Ajusta larguras das colunas
        const colWidths = sheet.columns.map(col => ({ wch: col.width || 15 }));
        ws['!cols'] = colWidths;
        
        // Formata cabeçalho
        const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
          if (!ws[cellAddress]) continue;
          ws[cellAddress].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: 'E8F5E9' } },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
        
        XLSX.utils.book_append_sheet(workbook, ws, sheet.name.substring(0, 31));
      }
    }

    // Gera buffer do Excel
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Retorna como download
    const filename = `Relatorio_EMSERH_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error('Erro ao gerar relatório Excel:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Erro ao gerar relatório Excel' },
      { status: 500 }
    );
  }
}
