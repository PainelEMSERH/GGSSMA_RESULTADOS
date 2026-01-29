export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { auth } from '@clerk/nextjs/server';

/** Formata data ISO para DD/MM/AAAA */
function toDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Mapa de células do modelo oficial RIAT (Anexo III - EMSERH).
 * Seção 1 DADOS DO EMPREGADO (7-12), Seção 2 DADOS DO ACIDENTE (14-25),
 * Seção 3 CAUSAS (36-38), Seção 5 PARECER SESMT (53-56).
 */
function getCellMap(): Record<string, string> {
  return {
    H3: 'dataInicialInvestigacao', I3: 'dataFinalInvestigacao', C5: 'responsavelInvestigacao', F6: 'numeroSinan',
    B7: 'nome', B8: 'matricula', B9: 'unidadeHospitalar', B10: 'funcaoTrabalhador', B11: 'tempoFuncao', B12: 'tempoExperiencia',
    B14: 'data', D14: 'hora', B15: 'localAcidente', G15: 'especificacaoLocal', G17: 'sesmtInformadoMotivo', D19: 'horasTrabalhadasAteOcorrencia', I19: 'diasTratamento', G21: 'causaImediata', D21: 'parteCorpoLesionada', B25: 'descricao',
    B20: 'tipo_tipico', C20: 'tipo_trajeto', D20: 'tipo_biologico', E20: 'tipo_quimico', F20: 'tipo_incidente', G19: 'afastamento_sim', H19: 'afastamento_nao',
    B36: 'fatorMaterial', B38: 'fatorHumano', B53: 'circunstancias', B54: 'impacto', B55: 'causaRaiz', B56: 'acoesCorretivas',
  };
}

/** POST — body: { acidente: { nome, data, hora, unidadeHospitalar, regional, numeroCAT, tipo, comAfastamento, descricao, setor?, funcaoTrabalhador?, causaImediata?, causaRaiz?, fatoresContrib? }, observacoes?, numeroSinan? }
 *  Preenche o modelo public/templates/riat.xlsx ou gera um modelo igual se o arquivo não existir.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const acidente = body.acidente || {};
    const observacoes = body.observacoes ?? '';
    const numeroSinan = body.numeroSinan ?? '';

    const tipoLabel: Record<string, string> = {
      biologico: 'Mat. Biológico / Perfurocortante',
      trajeto: 'Trajeto',
      tipico: 'Típico',
      de_trabalho: 'Acidente de Trabalho',
      outros: 'Outros',
    };
    const tipo = String(acidente.tipo ?? '');
    const comAfastamento = !!acidente.comAfastamento;

    const hoje = toDDMMYYYY(new Date().toISOString());

    const values: Record<string, string> = {
      dataInicialInvestigacao: hoje,
      dataFinalInvestigacao: hoje,
      responsavelInvestigacao: '',
      numeroSinan: String(numeroSinan),
      nome: String(acidente.nome ?? ''),
      matricula: '',
      unidadeHospitalar: String(acidente.unidadeHospitalar ?? ''),
      funcaoTrabalhador: String(acidente.funcaoTrabalhador ?? ''),
      tempoFuncao: '',
      tempoExperiencia: '',
      telefone: '',
      data: toDDMMYYYY(acidente.data),
      hora: String(acidente.hora ?? ''),
      localAcidente: String(acidente.unidadeHospitalar ?? ''),
      especificacaoLocal: String(acidente.descricao ?? '').slice(0, 200),
      sesmtInformadoMotivo: '',
      horasTrabalhadasAteOcorrencia: '',
      diasTratamento: '',
      causaImediata: String(acidente.causaImediata ?? ''),
      parteCorpoLesionada: '',
      descricao: String(acidente.descricao ?? ''),
      tipo_tipico: tipo === 'tipico' ? 'X' : '',
      tipo_trajeto: tipo === 'trajeto' ? 'X' : '',
      tipo_biologico: tipo === 'biologico' ? 'X' : '',
      tipo_quimico: '',
      tipo_incidente: '',
      afastamento_sim: comAfastamento ? 'X' : '',
      afastamento_nao: !comAfastamento ? 'X' : '',
      fatorMaterial: String(acidente.fatoresContrib ?? ''),
      fatorHumano: String(observacoes ?? ''),
      circunstancias: String(acidente.descricao ?? '').slice(0, 500),
      impacto: '',
      causaRaiz: String(acidente.causaRaiz ?? ''),
      acoesCorretivas: String(observacoes ?? ''),
    };

    const XLSX = await import('xlsx');
    const cellMap = getCellMap();
    let wb: import('xlsx').WorkBook;
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'riat.xlsx');

    if (fs.existsSync(templatePath)) {
      const buf = fs.readFileSync(templatePath);
      wb = XLSX.read(buf, { type: 'buffer' });
    } else {
      // Gerar modelo exatamente igual (estrutura oficial RIAT - Anexo III EMSERH)
      wb = XLSX.utils.book_new();
      const rowCount = 72;
      const colCount = 10;
      const rows: (string | number)[][] = Array.from({ length: rowCount }, () => Array(colCount).fill(''));
      const set = (r: number, c: number, v: string | number) => {
        if (r >= 0 && r < rowCount && c >= 0 && c < colCount) rows[r][c] = v;
      };
      set(0, 0, 'SEDE/DESSMA/PCG/0007 - Procedimento para Comunicação e Investigação de Acidentes_Rev02');
      set(0, 7, 'Data inicial da investigação');
      set(0, 8, 'Data final da investigação');
      set(1, 0, 'Anexo III - Ficha de Investigação de acidentes - RIAT');
      set(2, 1, 'RIAT');
      set(3, 1, 'RELATÓRIO DE INVESTIGAÇÃO E ANÁLISE DE ACIDENTES DE TRABALHO');
      set(4, 0, 'Responsável pela investigação:');
      set(4, 3, 'N° FICHA SINAN:');
      set(5, 0, 'Número CAT:'); // célula ao lado para valor
      set(6, 0, '1) DADOS DO EMPREGADO');
      set(7, 0, 'Nome:');
      set(8, 0, 'Matrícula:');
      set(9, 0, 'Lotação:');
      set(10, 0, 'Cargo/Função:');
      set(11, 0, 'Tempo na função na EMSERH:');
      set(12, 0, 'Tempo de experiência na Profissão:');
      set(13, 0, 'Idade:');
      set(13, 1, 'Sexo: F ( ) M ( )');
      set(13, 5, 'Mudou de endereço? Sim ( ) Não ( )');
      set(13, 6, 'Telefone:');
      set(12, 0, '2) DADOS DO ACIDENTE');
      set(13, 0, 'Data:');
      set(13, 2, 'Hora:');
      set(13, 4, 'Registro policial? Sim ( ) Não ( ) NA ( )');
      set(14, 0, 'Local do acidente:');
      set(14, 5, 'Especificação detalhada do local (Ponto de referência):');
      set(16, 0, 'O acidente foi informado ao SESMT, de imediato? Sim ( ) Não ( )');
      set(16, 5, 'Caso NÃO, por que?:');
      set(18, 0, 'Horas trabalhadas até a ocorrência:');
      set(18, 1, 'Tipo: Típico ( ) Trajeto ( ) Mat. Biológico ( ) Químico ( ) Incidente ( )');
      set(18, 6, 'Haverá afastamento? Sim ( ) Não ( )');
      set(18, 8, 'Se sim, nº dias p/tratamento:');
      set(19, 0, 'Houve lesão? Sim ( ) Não ( )');
      set(19, 1, 'Parte do corpo lesionada / lateralidade:');
      set(19, 6, 'Agente causador (Causa do Acidente):');
      set(20, 0, 'Natureza da lesão: Perfuro Cortante ( ) Escoriação ( ) Entorse ( ) Queimadura ( ) Outros ( )');
      set(20, 5, 'Nível de severidade real: Leve ( ) Moderado ( ) Grave ( ) Crítico ( ) Catastrófico ( )');
      set(24, 0, 'Descrição do acidente (informações do envolvido e/ou testemunha):');
      set(28, 0, 'Testemunha 1 - Nome:');
      set(28, 2, 'Cargo:');
      set(28, 4, 'Setor:');
      set(28, 6, 'Assinatura:');
      set(29, 0, 'Testemunha 2 - Nome:');
      set(29, 2, 'Cargo:');
      set(29, 4, 'Setor:');
      set(29, 6, 'Assinatura:');
      set(32, 0, 'Assinatura do colaborador acidentado: Declara estar de acordo com as causas apuradas pelo SESMT e ciente do PCG-0007.');
      set(34, 0, '3) IDENTIFICAÇÃO DAS CAUSAS DO ACIDENTE');
      set(35, 0, 'Fator de risco A - MATERIAL (objetos ou instrumentos com falta, falhas ou danificados):');
      set(37, 0, 'Fator de risco B: HUMANO (como o fator humano contribui para a exposição ao risco):');
      set(51, 0, '5) PARECER TÉCNICO DO SESMT');
      set(52, 0, 'Circunstâncias:');
      set(53, 0, 'Impacto:');
      set(54, 0, 'Causa Raiz:');
      set(55, 0, 'Ações Corretivas/Preventivas:');
      set(56, 0, '6) PLANO DE AÇÃO');
      set(57, 1, 'Ação');
      set(57, 5, 'Responsável');
      set(57, 8, 'Prazo');
      set(62, 0, '7) RESPONSABILIDADE/PARTICIPAÇÃO DA INVESTIGAÇÃO');
      set(63, 0, 'REPRESENTANTE DO SESMT/RH (OBRIGATÓRIO)');
      set(63, 4, 'Assinatura');
      set(63, 7, 'Data');
      set(64, 0, 'CHEFIA IMEDIATA (OBRIGATÓRIO)');
      set(64, 4, 'Assinatura');
      set(64, 7, 'Data');
      set(65, 0, 'NOME DO CIPEIRO (OBRIGATÓRIO)');
      set(65, 4, 'Assinatura');
      set(65, 7, 'Data');
      set(68, 0, '8) REGISTRO FOTOGRÁFICO');

      // Preencher valores no array (cellMap usa Excel 1-based: B7 = col B row 7)
      for (const [cell, fieldKey] of Object.entries(cellMap)) {
        const c = cell.charCodeAt(0) - 65;
        const r = parseInt(cell.slice(1), 10) - 1;
        const v = values[fieldKey] ?? '';
        if (r >= 0 && r < rowCount && c >= 0) {
          while (rows[r].length <= c) rows[r].push('');
          rows[r][c] = v;
        }
      }
      rows[4][5] = String(acidente.numeroCAT ?? ''); // F5 = Número CAT
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'RIAT');
    }

    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { ok: false, error: 'O Excel do modelo RIAT não possui abas.' },
        { status: 400 }
      );
    }
    const ws = wb.Sheets[sheetName];

    for (const [cell, fieldKey] of Object.entries(cellMap)) {
      const value = values[fieldKey] ?? '';
      if (!ws[cell]) ws[cell] = { t: 's', v: value };
      else (ws[cell] as { v?: unknown }).v = value;
    }

    // Número CAT (no modelo oficial pode estar em F5 ou em célula "Número CAT")
    const catVal = String(acidente.numeroCAT ?? '');
    const catCell = 'F5';
    if (!ws[catCell]) ws[catCell] = { t: 's', v: catVal };
    else (ws[catCell] as { v?: unknown }).v = catVal;

    const outBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const safeNome = (acidente.nome || 'acidente').replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, '').trim().slice(0, 40) || 'RIAT';
    const dataStr = toDDMMYYYY(acidente.data).replace(/\//g, '-');
    const filename = `RIAT_${safeNome}_${dataStr}.xlsx`;

    return new NextResponse(outBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error('[acidentes/riat-download]', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
