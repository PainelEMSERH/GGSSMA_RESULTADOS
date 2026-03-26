import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AreaGGSSMA, PolaridadeIndicador } from '@prisma/client';

const monthMap: { [key: string]: number } = {
  'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
  'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
};

function getArea(areaStr: string): AreaGGSSMA {
  const normalizedStr = areaStr.trim().toUpperCase().replace(/ /g, '_');
  if (normalizedStr.includes('SAUDE') || normalizedStr.includes('SAÚDE')) {
    return 'SAUDE_OCUPACIONAL';
  }
  if (normalizedStr.includes('SEGURANCA') || normalizedStr.includes('SEGURANÇA')) {
    return 'SEGURANCA_TRABALHO';
  }
  return 'MEIO_AMBIENTE';
}

function getPolarity(polarityStr: string): PolaridadeIndicador {
  return polarityStr.trim().toUpperCase() === 'MAIOR MELHOR' ? 'MAIOR_MELHOR' : 'MENOR_MELHOR';
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file: File | null = formData.get('file') as unknown as File;

  if (!file) {
    return NextResponse.json({ ok: false, error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileContent = buffer.toString('utf-8');

  try {
    const lines = fileContent.trim().split('\n').slice(1); 
    let processedCount = 0;

    for (const line of lines) {
      if (!line.trim()) continue;

      const values = line.split(';').map(v => v.trim().replace(/\"/g, ''));
      if (values.length < 9) continue;

      const [area, regional, responsavel, macroProcesso, nomeIndicador, unidMedida, polaridade, formula, mesAnoStr] = values;

      if (!mesAnoStr || !regional || !nomeIndicador) continue;

      const mesAnoParts = mesAnoStr.split('/');
      if (mesAnoParts.length !== 2) continue;

      const mes = monthMap[mesAnoParts[0].toLowerCase()];
      const ano = 2000 + parseInt(mesAnoParts[1], 10);
      if (!mes || isNaN(ano)) continue;

      const indicador = await prisma.indicadorGGSSMA.upsert({
        where: { nome_regional: { nome: nomeIndicador, regional: regional } },
        update: {},
        create: {
          nome: nomeIndicador,
          descricao: macroProcesso,
          area: getArea(area),
          regional: regional,
          responsavel: responsavel,
          macroProcesso: macroProcesso,
          unidadeMedida: unidMedida,
          polaridade: getPolarity(polaridade),
          formulaCalculo: formula,
        },
      });

      await prisma.resultadoMensalGGSSMA.create({
        data: {
          indicadorId: indicador.id,
          ano: ano,
          mes: mes,
        },
      });
      
      processedCount++;
    }

    return NextResponse.json({ ok: true, message: `✅ ${processedCount} registros processados com sucesso!`, imported: processedCount });

  } catch (error: any) {
    console.error('[GGSSMA_IMPORT_ERROR]', error);
    return NextResponse.json({ ok: false, error: `Erro no servidor: ${error.message}` }, { status: 500 });
  }
}
