export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { calcularStatus } from '@/lib/spci/utils';
import { loadContext, findUnidade, findRegional, processWithAI } from '@/lib/chat/ai-handler';
import { extractLocationNames } from '@/lib/chat/fuzzy-search';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/**
 * Executa query de extintores com busca fuzzy
 */
async function queryExtintores(question: string, context: any) {
  const locations = extractLocationNames(question);
  let unidade: string | null = null;
  let regional: string | null = null;

  // Busca fuzzy para unidade
  if (locations.unidades.length > 0) {
    for (const loc of locations.unidades) {
      const found = await findUnidade(loc);
      if (found) {
        unidade = found.unidade;
        if (!regional && found.regional) {
          regional = found.regional;
        }
        break;
      }
    }
  }

  // Busca fuzzy para regional
  if (locations.regionais.length > 0 && !regional) {
    for (const loc of locations.regionais) {
      const found = await findRegional(loc);
      if (found) {
        regional = found;
        break;
      }
    }
  }

  const whereConditions: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (regional) {
    queryParams.push(regional);
    whereConditions.push(`"Regional" = $${paramIndex}`);
    paramIndex++;
  }
  if (unidade) {
    queryParams.push(unidade);
    whereConditions.push(`TRIM("Unidade") ILIKE TRIM($${paramIndex})`);
    paramIndex++;
  }

  const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  const rows: any[] = queryParams.length > 0
    ? await prisma.$queryRawUnsafe(`SELECT "Unidade", "Regional", "Última recarga" FROM spci_planilha ${whereSql}`, ...queryParams)
    : await prisma.$queryRawUnsafe(`SELECT "Unidade", "Regional", "Última recarga" FROM spci_planilha ${whereSql}`);

  let total = 0;
  let vencidos = 0;
  let dentroPrazo = 0;

  for (const row of rows) {
    total++;
    const calculo = calcularStatus(row['Última recarga']);
    if (calculo.status === 'VENCIDO') vencidos++;
    else dentroPrazo++;
  }

  return {
    total,
    vencidos,
    dentroPrazo,
    unidade,
    regional,
  };
}

/**
 * Executa query de entregas com busca fuzzy
 */
async function queryEntregas(question: string, context: any) {
  const locations = extractLocationNames(question);
  let unidade: string | null = null;
  let regional: string | null = null;

  if (locations.unidades.length > 0) {
    for (const loc of locations.unidades) {
      const found = await findUnidade(loc);
      if (found) {
        unidade = found.unidade;
        if (!regional && found.regional) {
          regional = found.regional;
        }
        break;
      }
    }
  }

  if (locations.regionais.length > 0 && !regional) {
    for (const loc of locations.regionais) {
      const found = await findRegional(loc);
      if (found) {
        regional = found;
        break;
      }
    }
  }

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const iniDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const fimDate = new Date(ano, mes, 0).toISOString().slice(0, 10);

  let where = `WHERE b.data >= '${iniDate}' AND b.data <= '${fimDate}'`;
  if (regional) {
    where += ` AND EXISTS (SELECT 1 FROM stg_unid_reg ur WHERE UPPER(TRIM(ur.regional_responsavel)) = UPPER(TRIM('${regional.replace(/'/g, "''")}')) AND UPPER(TRIM(ur.nmdepartamento)) = UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))))`;
  }
  if (unidade) {
    where += ` AND UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER('%${unidade.replace(/'/g, "''")}%')`;
  }

  const rows: any[] = await prisma.$queryRawUnsafe(`
    WITH base AS (
      SELECT e.item, (elem->>'date')::date AS data, (elem->>'qty')::int AS quantidade
      FROM epi_entregas e
      CROSS JOIN LATERAL jsonb_array_elements(e.deliveries) elem
      LEFT JOIN stg_alterdata_v2 a ON a.cpf = e.cpf
    )
    SELECT COALESCE(SUM(b.quantidade), 0)::int AS total
    FROM base b
    ${where}
  `);

  return {
    total: rows[0]?.total || 0,
    periodo: `${mes}/${ano}`,
    unidade,
    regional,
  };
}

/**
 * Executa query de colaboradores com busca fuzzy
 */
async function queryColaboradores(question: string, context: any) {
  const locations = extractLocationNames(question);
  let unidade: string | null = null;
  let regional: string | null = null;

  if (locations.unidades.length > 0) {
    for (const loc of locations.unidades) {
      const found = await findUnidade(loc);
      if (found) {
        unidade = found.unidade;
        if (!regional && found.regional) {
          regional = found.regional;
        }
        break;
      }
    }
  }

  if (locations.regionais.length > 0 && !regional) {
    for (const loc of locations.regionais) {
      const found = await findRegional(loc);
      if (found) {
        regional = found;
        break;
      }
    }
  }

  let where = `WHERE a.demissao IS NULL OR a.demissao = '' OR TRIM(a.demissao) = ''`;
  if (regional) {
    where += ` AND EXISTS (SELECT 1 FROM stg_unid_reg ur WHERE UPPER(TRIM(ur.regional_responsavel)) = UPPER(TRIM('${regional.replace(/'/g, "''")}')) AND UPPER(TRIM(ur.nmdepartamento)) = UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))))`;
  }
  if (unidade) {
    where += ` AND UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER('%${unidade.replace(/'/g, "''")}%')`;
  }

  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(DISTINCT a.cpf)::int AS total
    FROM stg_alterdata_v2 a
    ${where}
  `);

  return {
    total: rows[0]?.total || 0,
    unidade,
    regional,
  };
}

/**
 * API de Chat inteligente com IA e busca fuzzy
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const question = String(body?.question || '').trim();
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];

    if (!question && messages.length === 0) {
      return NextResponse.json({ ok: false, error: 'Pergunta é obrigatória' }, { status: 400 });
    }

    const lastQuestion = question || (messages.length > 0 ? messages[messages.length - 1]?.content : '');
    if (!lastQuestion) {
      return NextResponse.json({ ok: false, error: 'Pergunta vazia' }, { status: 400 });
    }

    // Carrega contexto de unidades/regionais
    const context = await loadContext();

    // Tenta usar IA primeiro (se disponível)
    const aiResult = await processWithAI(lastQuestion, messages, context);
    if (aiResult.useAI && aiResult.response) {
      // Se a IA respondeu, ainda podemos enriquecer com dados reais se necessário
      const qLower = lastQuestion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Se a pergunta é sobre extintores, busca dados reais
      if (qLower.includes('extintor') || qLower.includes('spci')) {
        try {
          const data = await queryExtintores(lastQuestion, context);
          if (data.total > 0) {
            return NextResponse.json({
              ok: true,
              answer: `Na ${data.unidade ? `unidade "${data.unidade}"` : data.regional ? `regional "${data.regional}"` : 'sistema'} há ${data.total} extintor(es): ${data.dentroPrazo} dentro do prazo e ${data.vencidos} vencido(s).`,
              data,
              source: 'ai+data',
            });
          }
        } catch (e) {
          // Se falhar, usa resposta da IA mesmo
        }
      }

      return NextResponse.json(aiResult.response);
    }

    // Fallback: processamento baseado em padrões com busca fuzzy
    const qLower = lastQuestion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1) EXTINTORES
    if (qLower.includes('extintor') || qLower.includes('spci')) {
      try {
        const data = await queryExtintores(lastQuestion, context);
        const location = data.unidade ? `unidade "${data.unidade}"` : data.regional ? `regional "${data.regional}"` : 'sistema';
        return NextResponse.json({
          ok: true,
          answer: `Na ${location} há ${data.total} extintor(es): ${data.dentroPrazo} dentro do prazo e ${data.vencidos} vencido(s).`,
          data,
        });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: `Erro ao consultar extintores: ${e?.message}` }, { status: 500 });
      }
    }

    // 2) ENTREGAS
    if ((qLower.includes('entrega') && !qLower.includes('ordem')) || (qLower.includes('epi') && qLower.includes('entreg'))) {
      try {
        const data = await queryEntregas(lastQuestion, context);
        const location = data.unidade ? `unidade "${data.unidade}"` : data.regional ? `regional "${data.regional}"` : '';
        return NextResponse.json({
          ok: true,
          answer: `${data.total} EPI(s) entregue(s) neste mês${location ? ` na ${location}` : ''}.`,
          data,
        });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: `Erro: ${e?.message}` }, { status: 500 });
      }
    }

    // 3) COLABORADORES
    if (qLower.includes('colaborador') || qLower.includes('funcionario') || qLower.includes('pessoa') || qLower.includes('trabalhador')) {
      try {
        const data = await queryColaboradores(lastQuestion, context);
        const location = data.unidade ? `unidade "${data.unidade}"` : data.regional ? `regional "${data.regional}"` : '';
        return NextResponse.json({
          ok: true,
          answer: `${data.total} colaborador(es) ativo(s)${location ? ` na ${location}` : ''}.`,
          data,
        });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: `Erro: ${e?.message}` }, { status: 500 });
      }
    }

    // 4) ACIDENTES
    if (qLower.includes('acidente')) {
      const anoMatch = lastQuestion.match(/(\d{4})/);
      const ano = anoMatch ? parseInt(anoMatch[1], 10) : new Date().getFullYear();
      try {
        const rows: any[] = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*)::int AS total,
                 COUNT(CASE WHEN "comAfastamento" = true THEN 1 END)::int AS com_afastamento,
                 COUNT(CASE WHEN "comAfastamento" = false THEN 1 END)::int AS sem_afastamento
          FROM "Acidente"
          WHERE ano = $1
        `, ano);
        const data = rows[0] || { total: 0, com_afastamento: 0, sem_afastamento: 0 };
        return NextResponse.json({
          ok: true,
          answer: `Em ${ano} foram registrados ${data.total} acidente(s): ${data.com_afastamento} com afastamento e ${data.sem_afastamento} sem afastamento.`,
          data,
        });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: `Erro: ${e?.message}` }, { status: 500 });
      }
    }

    // 5) ESTOQUE
    if (qLower.includes('estoque') || (qLower.includes('item') && qLower.includes('abaixo'))) {
      try {
        const locations = extractLocationNames(lastQuestion);
        let unidade: string | null = null;
        let regional: string | null = null;

        if (locations.unidades.length > 0) {
          const found = await findUnidade(locations.unidades[0]);
          if (found) unidade = found.unidade;
        }
        if (locations.regionais.length > 0 && !regional) {
          const found = await findRegional(locations.regionais[0]);
          if (found) regional = found;
        }

        let where = `WHERE e.quantidade < e.minimo`;
        const params: any[] = [];
        let paramIndex = 1;

        if (regional) {
          params.push(regional);
          where += ` AND EXISTS (SELECT 1 FROM "Regional" r WHERE r.id = u."regionalId" AND UPPER(TRIM(r.nome)) = UPPER(TRIM($${paramIndex})))`;
          paramIndex++;
        }
        if (unidade) {
          params.push(`%${unidade}%`);
          where += ` AND UPPER(TRIM(u.nome)) LIKE UPPER($${paramIndex})`;
          paramIndex++;
        }

        const rows: any[] = params.length > 0
          ? await prisma.$queryRawUnsafe(`
              SELECT u.nome AS unidade, i.nome AS item, e.quantidade::int, e.minimo::int
              FROM "Estoque" e
              JOIN "Item" i ON i.id = e."itemId"
              JOIN "Unidade" u ON u.id = e."unidadeId"
              ${where}
              ORDER BY e.quantidade ASC
              LIMIT 20
            `, ...params)
          : await prisma.$queryRawUnsafe(`
              SELECT u.nome AS unidade, i.nome AS item, e.quantidade::int, e.minimo::int
              FROM "Estoque" e
              JOIN "Item" i ON i.id = e."itemId"
              JOIN "Unidade" u ON u.id = e."unidadeId"
              ${where}
              ORDER BY e.quantidade ASC
              LIMIT 20
            `);

        if (rows.length === 0) {
          const location = unidade ? `unidade "${unidade}"` : regional ? `regional "${regional}"` : '';
          return NextResponse.json({
            ok: true,
            answer: `Nenhum item abaixo do mínimo${location ? ` na ${location}` : ''}.`,
          });
        }
        const lista = rows.map((r: any) => `• ${r.unidade}: ${r.item} (${r.quantidade} de ${r.minimo})`).join('\n');
        return NextResponse.json({
          ok: true,
          answer: `Itens abaixo do mínimo:\n\n${lista}${rows.length >= 20 ? '\n\n(mostrando os 20 primeiros)' : ''}`,
          data: { count: rows.length, items: rows },
        });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: `Erro: ${e?.message}` }, { status: 500 });
      }
    }

    // Resposta padrão conversacional
    return NextResponse.json({
      ok: true,
      answer: 'Olá! Posso ajudar você com informações sobre:\n\n• Extintores (SPCI) - quantos tem, quais estão vencidos\n• Entregas de EPI - quantas foram feitas, por unidade/regional\n• Estoque - itens abaixo do mínimo\n• Acidentes - registros por ano\n• Colaboradores - quantos ativos por unidade/regional\n• Ordens de Serviço\n\nPergunte de forma natural, por exemplo:\n"Quantos extintores tem no macro ruth noleto?"\n"Quantas entregas foram feitas este mês na regional sul?"\n\nComo posso ajudar?',
      suggestions: [
        'Quantos extintores tem no macro ruth noleto?',
        'Quantas entregas foram feitas este mês?',
        'Quais itens estão abaixo do mínimo?',
        'Quantos colaboradores ativos na regional sul?',
      ],
    });
  } catch (e: any) {
    console.error('[chat] erro:', e);
    return NextResponse.json({ ok: false, error: `Erro interno: ${e?.message || String(e)}` }, { status: 500 });
  }
}
