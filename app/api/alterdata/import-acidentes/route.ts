export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import * as sql from 'mssql';

// Configuração de conexão SQL Server (READ-ONLY)
const sqlServerConfig: sql.config = {
  server: '192.168.176.5\\ALTERDATA',
  database: 'ALTERDATA_PACK',
  user: 'DESSMA',
  password: '#De$Ma2024!',
  options: {
    encrypt: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

/**
 * Função auxiliar para buscar campo com várias variações de nome
 */
function getField(row: any, ...variations: string[]): any {
  for (const varName of variations) {
    if (row[varName] !== undefined && row[varName] !== null && row[varName] !== '') {
      return row[varName];
    }
    // Tenta case-insensitive
    const keys = Object.keys(row);
    const found = keys.find(k => k.toLowerCase() === varName.toLowerCase());
    if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
      return row[found];
    }
  }
  return null;
}

/**
 * Mapeia dados do Alterdata para o schema do Prisma
 * Tenta várias variações de nomes de campos automaticamente
 */
function mapAlterdataToPrisma(row: any): {
  nome: string;
  empresa: 'IADVH' | 'EMSERH';
  unidadeHospitalar: string;
  regional: string | null;
  tipo: 'biologico' | 'trajeto' | 'tipico' | 'de_trabalho' | 'outros';
  comAfastamento: boolean;
  data: Date;
  hora: string | null;
  mes: number;
  ano: number;
  numeroCAT: string | null;
  riat: string | null;
  sinan: string | null;
  status: 'aberto' | 'em_analise' | 'concluido' | 'cancelado';
  descricao: string | null;
  setor: string | null;
  funcaoTrabalhador: string | null;
  tipoVinculo: string | null;
  causaImediata: string | null;
  causaRaiz: string | null;
  fatoresContrib: string | null;
} {
  // Busca nome do colaborador com várias variações
  const nomeRaw = getField(row, 'Nome', 'NOME', 'Colaborador', 'COLABORADOR', 'NomeColaborador', 'NOME_COLABORADOR', 'Funcionario', 'FUNCIONARIO');
  const nome = nomeRaw ? String(nomeRaw).trim() : '';

  // Busca data do acidente
  const dataRaw = getField(row, 'DataAcidente', 'DATA_ACIDENTE', 'Data', 'DATA', 'DtAcidente', 'DT_ACIDENTE', 'DataOcorrencia', 'DATA_OCORRENCIA');
  let dataObj: Date;
  if (dataRaw instanceof Date) {
    dataObj = dataRaw;
  } else if (dataRaw) {
    const parsed = new Date(dataRaw);
    dataObj = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    dataObj = new Date();
  }
  
  const mes = dataObj.getMonth() + 1;
  const ano = dataObj.getFullYear();

  // Busca tipo de acidente e mapeia
  const tipoRaw = getField(row, 'TipoAcidente', 'TIPO_ACIDENTE', 'Tipo', 'TIPO', 'TipoAcid', 'TIPO_ACID');
  const tipoStr = tipoRaw ? String(tipoRaw).toLowerCase() : '';
  let tipo: 'biologico' | 'trajeto' | 'tipico' | 'de_trabalho' | 'outros' = 'outros';
  if (tipoStr.includes('biológico') || tipoStr.includes('biologico') || tipoStr.includes('biologico')) tipo = 'biologico';
  else if (tipoStr.includes('trajeto') || tipoStr.includes('transito') || tipoStr.includes('trânsito')) tipo = 'trajeto';
  else if (tipoStr.includes('típico') || tipoStr.includes('tipico')) tipo = 'tipico';
  else if (tipoStr.includes('trabalho') && !tipoStr.includes('de_trabalho')) tipo = 'de_trabalho';

  // Busca empresa
  const empresaRaw = getField(row, 'Empresa', 'EMPRESA', 'Emp', 'EMP');
  const empresaStr = empresaRaw ? String(empresaRaw).toUpperCase() : 'EMSERH';
  const empresa: 'IADVH' | 'EMSERH' = empresaStr === 'IADVH' ? 'IADVH' : 'EMSERH';

  // Busca unidade hospitalar
  const unidadeRaw = getField(row, 'UnidadeHospitalar', 'UNIDADE_HOSPITALAR', 'Unidade', 'UNIDADE', 'Unid', 'UNID', 'UnidadeHospital', 'UNIDADE_HOSPITAL');
  const unidadeHospitalar = unidadeRaw ? String(unidadeRaw).trim() : '';

  // Busca regional
  const regionalRaw = getField(row, 'Regional', 'REGIONAL', 'Regiao', 'REGIAO', 'Reg', 'REG');
  const regional = regionalRaw ? String(regionalRaw).trim() : null;

  // Busca afastamento
  const afastamentoRaw = getField(row, 'ComAfastamento', 'COM_AFASTAMENTO', 'Afastamento', 'AFASTAMENTO', 'Afastado', 'AFASTADO', 'TemAfastamento', 'TEM_AFASTAMENTO');
  const comAfastamento = Boolean(afastamentoRaw === true || afastamentoRaw === 1 || String(afastamentoRaw).toLowerCase() === 'sim' || String(afastamentoRaw).toLowerCase() === 'true');

  // Busca hora
  const horaRaw = getField(row, 'Hora', 'HORA', 'HoraAcidente', 'HORA_ACIDENTE', 'Horario', 'HORARIO');
  const hora = horaRaw ? String(horaRaw).trim() : null;

  // Busca número CAT
  const catRaw = getField(row, 'NumeroCAT', 'NUMERO_CAT', 'CAT', 'cat', 'NumCAT', 'NUM_CAT', 'NrCAT', 'NR_CAT');
  const numeroCAT = catRaw ? String(catRaw).trim() : null;

  // Busca RIAT
  const riatRaw = getField(row, 'RIAT', 'riat', 'Riat', 'NumeroRIAT', 'NUMERO_RIAT');
  const riat = riatRaw ? String(riatRaw).trim() : null;

  // Busca SINAN
  const sinanRaw = getField(row, 'SINAN', 'sinan', 'Sinan', 'NumeroSINAN', 'NUMERO_SINAN');
  const sinan = sinanRaw ? String(sinanRaw).trim() : null;

  // Busca descrição
  const descRaw = getField(row, 'Descricao', 'DESCRICAO', 'DescricaoAcidente', 'DESCRICAO_ACIDENTE', 'Desc', 'DESC', 'Observacao', 'OBSERVACAO', 'Obs', 'OBS');
  const descricao = descRaw ? String(descRaw).trim() : null;

  // Busca setor
  const setorRaw = getField(row, 'Setor', 'SETOR', 'Departamento', 'DEPARTAMENTO', 'Dept', 'DEPT');
  const setor = setorRaw ? String(setorRaw).trim() : null;

  // Busca função do trabalhador
  const funcaoRaw = getField(row, 'FuncaoTrabalhador', 'FUNCAO_TRABALHADOR', 'Funcao', 'FUNCAO', 'Cargo', 'CARGO', 'FuncaoColaborador', 'FUNCAO_COLABORADOR');
  const funcaoTrabalhador = funcaoRaw ? String(funcaoRaw).trim() : null;

  // Busca tipo de vínculo
  const vinculoRaw = getField(row, 'TipoVinculo', 'TIPO_VINCULO', 'Vinculo', 'VINCULO', 'TipoVinculacao', 'TIPO_VINCULACAO');
  const tipoVinculo = vinculoRaw ? String(vinculoRaw).trim() : null;

  // Busca causa imediata
  const causaImRaw = getField(row, 'CausaImediata', 'CAUSA_IMEDIATA', 'Causa', 'CAUSA', 'CausaIm', 'CAUSA_IM');
  const causaImediata = causaImRaw ? String(causaImRaw).trim() : null;

  // Busca causa raiz
  const causaRaizRaw = getField(row, 'CausaRaiz', 'CAUSA_RAIZ', 'CausaRoot', 'CAUSA_ROOT', 'CausaFundamental', 'CAUSA_FUNDAMENTAL');
  const causaRaiz = causaRaizRaw ? String(causaRaizRaw).trim() : null;

  // Busca fatores contribuintes
  const fatoresRaw = getField(row, 'FatoresContrib', 'FATORES_CONTRIB', 'FatoresContribuintes', 'FATORES_CONTRIBUINTES', 'Fatores', 'FATORES');
  const fatoresContrib = fatoresRaw ? String(fatoresRaw).trim() : null;

  return {
    nome,
    empresa,
    unidadeHospitalar,
    regional,
    tipo,
    comAfastamento,
    data: dataObj,
    hora,
    mes,
    ano,
    numeroCAT,
    riat,
    sinan,
    status: 'aberto' as const,
    descricao,
    setor,
    funcaoTrabalhador,
    tipoVinculo,
    causaImediata,
    causaRaiz,
    fatoresContrib,
  };
}

/**
 * POST /api/alterdata/import-acidentes
 * Importa acidentes do SQL Server do Alterdata para o banco Neon
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    let pool: sql.ConnectionPool | null = null;
    let imported = 0;
    let updated = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    try {
      // Conecta ao SQL Server (READ-ONLY)
      pool = await sql.connect(sqlServerConfig);
      
      // Consulta a tabela wdp.CAT
      const result = await pool.request().query('SELECT * FROM wdp.CAT');
      const rows = result.recordset;

      if (!rows || rows.length === 0) {
        return NextResponse.json({
          ok: true,
          message: 'Nenhum acidente encontrado no Alterdata',
          imported: 0,
          updated: 0,
          errors: 0,
        });
      }

      // Processa cada linha
      for (const row of rows) {
        try {
          const data = mapAlterdataToPrisma(row);
          
          // Validações básicas
          if (!data.nome || !data.unidadeHospitalar || !data.data) {
            errors++;
            errorMessages.push(`Linha inválida: faltam dados obrigatórios (nome, unidade ou data)`);
            continue;
          }

          // Usa númeroCAT + data como chave única para evitar duplicatas
          const uniqueKey = data.numeroCAT 
            ? `cat_${data.numeroCAT}_${data.data.toISOString().split('T')[0]}`
            : `nome_${data.nome}_${data.data.toISOString().split('T')[0]}_${data.hora || ''}`;

          // Verifica se já existe (por númeroCAT ou por nome+data+hora)
          const existing = await prisma.acidente.findFirst({
            where: data.numeroCAT
              ? { numeroCAT: data.numeroCAT }
              : {
                  nome: data.nome,
                  data: {
                    gte: new Date(data.data.getFullYear(), data.data.getMonth(), data.data.getDate()),
                    lt: new Date(data.data.getFullYear(), data.data.getMonth(), data.data.getDate() + 1),
                  },
                  hora: data.hora,
                },
          });

          if (existing) {
            // Atualiza registro existente
            await prisma.acidente.update({
              where: { id: existing.id },
              data: {
                ...data,
                atualizadoEm: new Date(),
              },
            });
            updated++;
          } else {
            // Cria novo registro
            await prisma.acidente.create({
              data: {
                ...data,
                criadoPor: userId,
              },
            });
            imported++;
          }
        } catch (e: any) {
          errors++;
          errorMessages.push(`Erro ao processar linha: ${e?.message || String(e)}`);
          console.error('[import-acidentes] erro ao processar linha:', e);
        }
      }

      return NextResponse.json({
        ok: true,
        message: `Importação concluída: ${imported} novos, ${updated} atualizados, ${errors} erros`,
        imported,
        updated,
        errors,
        total: rows.length,
        errorMessages: errorMessages.slice(0, 10), // Limita a 10 erros no retorno
      });
    } catch (e: any) {
      console.error('[import-acidentes] erro de conexão:', e);
      return NextResponse.json(
        {
          ok: false,
          error: `Erro ao conectar ao SQL Server: ${e?.message || String(e)}`,
        },
        { status: 500 }
      );
    } finally {
      // Fecha conexão
      if (pool) {
        try {
          await pool.close();
        } catch (e) {
          console.error('[import-acidentes] erro ao fechar conexão:', e);
        }
      }
    }
  } catch (e: any) {
    console.error('[import-acidentes] erro geral:', e);
    return NextResponse.json(
      { ok: false, error: `Erro interno: ${e?.message || String(e)}` },
      { status: 500 }
    );
  }
}
