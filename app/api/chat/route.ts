export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { calcularStatus } from '@/lib/spci/utils';
import { loadContext, findUnidade, findRegional, processWithAI } from '@/lib/chat/ai-handler';
import { extractLocationNames } from '@/lib/chat/fuzzy-search';
import { answerWithToolCalling } from '@/lib/chat/tool-agent';
import {
  queryColaboradoresUnidade,
  queryMetaEntrega,
  queryEPIEntregue,
  queryDemitidos,
  queryUltimaAtualizacaoAlterdata,
  queryAcidentes,
  queryUltimaAcidentada,
  queryColaboradorMaisVelho,
  queryColaboradorRecenteUnidade,
  queryFuncaoColaborador,
  queryMatriculaColaborador,
  queryUnidadeExiste,
  queryBuscarColaborador,
} from '@/lib/chat/query-handlers';

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

/** Critério de colaborador ativo: igual às outras APIs (entregas/meta/diagnóstico) */
const DEMISSAO_WHERE = `(
  a.demissao IS NULL
  OR a.demissao = ''
  OR TRIM(a.demissao) = ''
  OR (
    CASE
      WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
      WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
      WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
      ELSE NULL
    END
  ) IS NOT NULL
  AND EXTRACT(YEAR FROM (
    CASE
      WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
      WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
      WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
      ELSE NULL
    END
  ))::int >= 2026
)`;

/**
 * Executa query de colaboradores com busca fuzzy.
 * Usa match exato por unidade (como entregas/diagnóstico) e mesmo critério de "ativo" (demissão nula ou ano >= 2026).
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

  // Match exato por unidade (não LIKE), igual às APIs de entregas/diagnóstico
  const esc = (s: string) => s.replace(/'/g, "''");
  let where = `WHERE ${DEMISSAO_WHERE} AND COALESCE(a.cpf, '') != '' AND COALESCE(a.funcao, '') != ''`;

  if (regional && !unidade) {
    where += ` AND EXISTS (SELECT 1 FROM stg_unid_reg ur WHERE UPPER(TRIM(ur.regional_responsavel)) = UPPER(TRIM('${esc(regional)}')) AND UPPER(TRIM(ur.nmdepartamento)) = UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))))`;
  }
  if (unidade) {
    where += ` AND (UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${esc(unidade)}')) OR EXISTS (SELECT 1 FROM stg_unid_reg ur WHERE UPPER(TRIM(ur.nmdepartamento)) = UPPER(TRIM('${esc(unidade)}')) AND UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(ur.nmdepartamento))))`;
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

    // Se a pergunta for continuação ("ela", "essa", "aí"), tenta inferir a última unidade citada
    const inferLastUnit = (msgs: Array<{ role: string; content: string }>): string | null => {
      // Procura de trás pra frente por: unidade "NOME..."
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        const txt = String(m?.content || '');
        const match = txt.match(/unidade\s+\"([^\"]+)\"/i);
        if (match?.[1]) return match[1].trim();
      }
      return null;
    };

    // Carrega contexto de unidades/regionais
    const context = await loadContext();

    // Normaliza pergunta para análise
    let effectiveQuestion = lastQuestion;
    const qLower = lastQuestion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const isFollowup = /\b(ela|essa|esse|isso|a[ií]|da[ií]|dessa|desse)\b/i.test(qLower);
    if (isFollowup) {
      const lastUnit = inferLastUnit(messages as any);
      if (lastUnit && !/unidade\s+/i.test(effectiveQuestion)) {
        // “cola” o contexto da unidade na pergunta para os handlers/tools entenderem
        effectiveQuestion = `${effectiveQuestion} na unidade ${lastUnit}`;
      }
    }

    // MODO "absurdamente inteligente": IA escolhe uma TOOL e a API executa a consulta real.
    // Só ativa se houver OPENAI_API_KEY; caso contrário, cai para os handlers atuais.
    try {
      const toolAnswer = await answerWithToolCalling({ question: effectiveQuestion, messages });
      if (toolAnswer?.ok) {
        return NextResponse.json({
          ok: true,
          answer: toolAnswer.answer,
          source: toolAnswer.source,
          data: toolAnswer.data,
        });
      }
    } catch {
      // se a IA falhar, seguimos com os handlers locais
    }

    // Perguntas "humanas" / identidade do assistente (não são de banco)
    // Ex: "como você se chama?", "quem é você?", "o que você faz?"
    const isIdentityQuestion = qLower.match(
      /\b(como (voce|vc) se chama|qual (seu|teu) nome|quem (e|eh) (voce|vc)|voce (e|eh) quem|o que (voce|vc) faz|como funciona (isso|esse chat)|ajuda|me ajuda)\b/i
    );

    if (isIdentityQuestion) {
      // Se tiver IA, deixa ela responder de forma natural
      const aiIdentity = await processWithAI(effectiveQuestion, messages, context);
      if (aiIdentity.useAI && aiIdentity.response) {
        return NextResponse.json(aiIdentity.response);
      }

      // Fallback sem IA
      return NextResponse.json({
        ok: true,
        answer:
          'Eu sou a Assistente Virtual da EMSERH. Posso responder perguntas e buscar dados do sistema (colaboradores, entregas de EPI, extintores, acidentes, estoque etc.).\n\nPode mandar sua pergunta do jeito que você fala no dia a dia.',
      });
    }

    // Detecta saudações e conversas casuais - responde naturalmente SEM buscar dados
    const isGreeting = qLower.match(/\b(ol[áa]|oi|e[ai]|tudo bem|como vai|beleza|e a[ií]|opa|eae|bom dia|boa tarde|boa noite)\b/i);
    const isCasual = qLower.match(/\b(beleza|tranquilo|suave|de boa|de boas|blz|tmj|valeu|obrigad[ao]|obg|tchau|até|flw|ok|okay|entendi|entendido)\b/i);
    
    if (isGreeting || isCasual || lastQuestion.trim().length < 10) {
      // Tenta usar IA para responder naturalmente
      const aiResult = await processWithAI(effectiveQuestion, messages, context);
      if (aiResult.useAI && aiResult.response) {
        return NextResponse.json(aiResult.response);
      }
      // Fallback conversacional
      if (isGreeting) {
        return NextResponse.json({
          ok: true,
          answer: 'Olá! Tudo bem sim, obrigado. Como posso ajudar você hoje?',
        });
      }
      if (isCasual) {
        return NextResponse.json({
          ok: true,
          answer: 'Por nada! Se precisar de mais alguma coisa, é só chamar!',
        });
      }
      // Se for muito curto e não identificou, tenta IA
      if (lastQuestion.trim().length < 10) {
        const aiResult = await processWithAI(lastQuestion, messages, context);
        if (aiResult.useAI && aiResult.response) {
          return NextResponse.json(aiResult.response);
        }
      }
    }

    // Tenta usar IA primeiro (se disponível)
    const aiResult = await processWithAI(effectiveQuestion, messages, context);
    if (aiResult.useAI && aiResult.response) {
      // Se a IA respondeu, ainda podemos enriquecer com dados reais se necessário

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
    const locations = extractLocationNames(effectiveQuestion);

    // Detecção de intenções específicas primeiro

    // 0) Buscar colaborador específico pelo nome ("encontre fulano", "procura ciclano")
    if (
      (qLower.includes('encontra') || qLower.includes('procura') || qLower.includes('achar')) &&
      (qLower.includes('colaborador') || qLower.includes('pessoa') || qLower.includes('funcionario') || /\b[A-Z][a-z]+ [A-Z][a-z]+/.test(lastQuestion))
    ) {
      try {
        const r = await queryBuscarColaborador(effectiveQuestion);
        if (!r.nomeBuscado) {
          return NextResponse.json({
            ok: true,
            answer: 'Me diz o nome completo do colaborador que você quer encontrar (por exemplo: "encontre o colaborador Jonathan Silva Alves").',
          });
        }

        if (r.resultados.length === 0) {
          return NextResponse.json({
            ok: true,
            answer: `Não encontrei nenhum colaborador que pareça com "${r.nomeBuscado}". Tenta me mandar o nome completo ou o CPF.`,
            data: r,
          });
        }

        if (r.resultados.length === 1) {
          const c = r.resultados[0];
          const status = c.ativo ? 'ativo' : 'inativo';
          return NextResponse.json({
            ok: true,
            answer: `Encontrei: ${c.nome} (CPF: ${c.cpf || 'sem CPF informado'}), ${status}${c.funcao ? `, função ${c.funcao}` : ''}${c.unidade ? `, unidade ${c.unidade}` : ''}${c.regional ? `, Regional ${c.regional}` : ''}.`,
            data: r,
          });
        }

        const lista = r.resultados
          .map(
            (c) =>
              `- ${c.nome} (CPF: ${c.cpf || 'sem CPF'}, ${c.funcao || 'sem função'}, ${c.unidade || 'sem unidade'}${
                c.regional ? `, Regional ${c.regional}` : ''
              })`
          )
          .join('\n');

        return NextResponse.json({
          ok: true,
          answer: `Encontrei mais de um colaborador parecido com "${r.nomeBuscado}". Veja as opções:\n\n${lista}\n\nMe diga exatamente qual deles você quer usar nas próximas perguntas (pode copiar e colar o nome).`,
          data: r,
        });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: `Erro ao buscar colaborador: ${e?.message}` }, { status: 500 });
      }
    }

    // 0) "A unidade X existe?"
    if (
      (qLower.includes('unidade') || qLower.includes('hospital') || qLower.includes('upa') || locations.unidades.length > 0) &&
      (qLower.includes('existe') || qLower.includes('tem') || qLower.includes('tem essa'))
    ) {
      try {
        const r = await queryUnidadeExiste(lastQuestion);
        if (!r.unidadeInformada) {
          return NextResponse.json({
            ok: true,
            answer: 'Qual unidade você quer verificar? Ex: \"A unidade Ruth Noleto existe?\"',
          });
        }

        if (r.existe && r.melhorMatch) {
          return NextResponse.json({
            ok: true,
            answer: `Sim — encontrei a unidade \"${r.melhorMatch.unidade}\"${r.melhorMatch.regional ? ` (Regional ${r.melhorMatch.regional})` : ''}.`,
            data: r,
          });
        }

        if (r.sugestoes.length > 0) {
          const sug = r.sugestoes
            .map((s) => `- ${s.unidade}${s.regional ? ` (Regional ${s.regional})` : ''}`)
            .join('\n');
          return NextResponse.json({
            ok: true,
            answer:
              `Não encontrei uma unidade com esse nome exatamente. Você quis dizer alguma dessas?\n\n${sug}\n\nResponda com o nome correto que eu confirmo.`,
            data: r,
          });
        }

        return NextResponse.json({
          ok: true,
          answer:
            'Não encontrei essa unidade no cadastro atual. Se você me disser a cidade ou a regional, eu tento localizar pelo nome aproximado.',
          data: r,
        });
      } catch {
        // Continua para os outros handlers
      }
    }

    // 1) Colaboradores em unidade específica
    if ((qLower.includes('colaborador') || qLower.includes('funcionario') || qLower.includes('pessoa') || qLower.includes('trabalhador'))
        && (qLower.includes('upa') || qLower.includes('unidade') || qLower.includes('hospital') || locations.unidades.length > 0)) {
      try {
        const data = await queryColaboradoresUnidade(effectiveQuestion);
        if (data.unidade) {
          return NextResponse.json({
            ok: true,
            answer: `Na unidade "${data.unidade}" há ${data.total} colaborador(es) ativo(s).`,
            data,
          });
        }
      } catch (e: any) {
        // Continua para outros handlers
      }
    }

    // 2) Planejado de entrega (meta)
    if ((qLower.includes('planejado') || qLower.includes('meta') || qLower.includes('previsto'))
        && (qLower.includes('entrega') || qLower.includes('epi'))) {
      try {
        const data = await queryMetaEntrega(lastQuestion);
        return NextResponse.json({
          ok: true,
          answer: `O planejado de entrega de EPI para ${data.mes}/${data.ano} é de ${data.meta} unidade(s).`,
          data,
        });
      } catch (e: any) {
        // Continua
      }
    }

    // 3) EPI específico entregue (ex: máscaras N95)
    if ((qLower.includes('entregue') || qLower.includes('entregou')) && (qLower.includes('mascara') || qLower.includes('n95') || qLower.includes('luva') || qLower.includes('epi'))) {
      try {
        const data = await queryEPIEntregue(lastQuestion);
        if (data.epi && data.unidade) {
          return NextResponse.json({
            ok: true,
            answer: `Foram entregues ${data.total} unidade(s) de ${data.epi} na unidade "${data.unidade}".`,
            data,
          });
        }
      } catch (e: any) {
        // Continua
      }
    }

    // 4) Demitidos em período específico
    if (qLower.includes('demitido') || qLower.includes('demissao')) {
      try {
        const data = await queryDemitidos(lastQuestion);
        const periodo = data.mes ? `${data.mes}/${data.ano}` : `${data.ano}`;
        return NextResponse.json({
          ok: true,
          answer: `Em ${periodo} foram registrados ${data.total} demitido(s).`,
          data,
        });
      } catch (e: any) {
        // Continua
      }
    }

    // 5) Última atualização do Alterdata
    if (qLower.includes('ultima') && (qLower.includes('atualiz') || qLower.includes('alterdata'))) {
      try {
        const data = await queryUltimaAtualizacaoAlterdata();
        return NextResponse.json({
          ok: true,
          answer: data.data ? `A última atualização do Alterdata foi em ${data.data}.` : 'Não foi possível encontrar a data da última atualização do Alterdata.',
          data,
        });
      } catch (e: any) {
        // Continua
      }
    }

    // 6) Acidentes por regional e mês
    if (qLower.includes('acidente') && (qLower.includes('regional') || locations.regionais.length > 0)) {
      try {
        const data = await queryAcidentes(lastQuestion);
        if (data.regionais.length > 0) {
          const regs = data.regionais.join(' e ');
          const periodo = data.mes ? `${data.mes}/${data.ano}` : `${data.ano}`;
          return NextResponse.json({
            ok: true,
            answer: `Na(s) regional(is) ${regs} em ${periodo} foram registrados ${data.total} acidente(s).`,
            data,
          });
        }
      } catch (e: any) {
        // Continua
      }
    }

    // 7) Última acidentada
    if (qLower.includes('ultima') && qLower.includes('acident')) {
      try {
        const data = await queryUltimaAcidentada();
        return NextResponse.json({
          ok: true,
          answer: data.nome ? `A última acidentada registrada foi ${data.nome}${data.data ? ` em ${data.data}` : ''}.` : 'Não foi encontrada nenhuma acidentada registrada.',
          data,
        });
      } catch (e: any) {
        // Continua
      }
    }

    // 8) Colaborador mais velho
    if ((qLower.includes('mais velho') || qLower.includes('mais antigo') || qLower.includes('tempo')) && qLower.includes('colaborador')) {
      try {
        const data = await queryColaboradorMaisVelho();
        return NextResponse.json({
          ok: true,
          answer: data.nome ? `O colaborador mais velho da EMSERH é ${data.nome}${data.admissao ? ` (admitido em ${data.admissao})` : ''}.` : 'Não foi possível encontrar o colaborador mais velho.',
          data,
        });
      } catch (e: any) {
        // Continua
      }
    }

    // 9) Colaborador que entrou recentemente em unidade
    if ((qLower.includes('recente') || qLower.includes('entrou') || qLower.includes('admitido')) && (qLower.includes('upa') || qLower.includes('unidade') || locations.unidades.length > 0)) {
      try {
        const data = await queryColaboradorRecenteUnidade(lastQuestion);
        if (data.unidade && data.nome) {
          return NextResponse.json({
            ok: true,
            answer: `O colaborador que entrou mais recentemente na unidade "${data.unidade}" foi ${data.nome}${data.admissao ? ` (admitido em ${data.admissao})` : ''}.`,
            data,
          });
        }
      } catch (e: any) {
        // Continua
      }
    }

    // 10) Função de colaborador específico
    if (qLower.includes('funcao') || qLower.includes('cargo')) {
      try {
        const data = await queryFuncaoColaborador(lastQuestion);
        if (data.nome && data.funcao) {
          return NextResponse.json({
            ok: true,
            answer: `A função de ${data.nome} é ${data.funcao}.`,
            data,
          });
        }
      } catch (e: any) {
        // Continua
      }
    }

    // 11) Matrícula de colaborador específico
    if (qLower.includes('matricula') || qLower.includes('matrícula')) {
      try {
        const data = await queryMatriculaColaborador(lastQuestion);
        if (data.nome) {
          if (data.matricula) {
            return NextResponse.json({
              ok: true,
              answer: `A matrícula do colaborador ${data.nome} é ${data.matricula}.`,
              data,
            });
          } else {
            return NextResponse.json({
              ok: true,
              answer: `Encontrei o colaborador "${data.nome}", mas não há matrícula cadastrada para ele.`,
              data,
            });
          }
        }
      } catch (e: any) {
        // Continua
      }
    }

    // Padrões gerais abaixo

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

    // Resposta padrão conversacional - tenta IA primeiro
    const aiFallback = await processWithAI(effectiveQuestion, messages, context);
    if (aiFallback.useAI && aiFallback.response) {
      return NextResponse.json(aiFallback.response);
    }

    // Se não conseguiu entender, responde de forma simples (sem texto engessado)
    return NextResponse.json({
      ok: true,
      answer:
        'Entendi que você está conversando comigo, mas não ficou claro o que você quer saber. Pode me dizer, em uma frase, qual dúvida você tem sobre colaboradores, EPIs, acidentes, estoque ou unidades?',
    });
  } catch (e: any) {
    console.error('[chat] erro:', e);
    return NextResponse.json({ ok: false, error: `Erro interno: ${e?.message || String(e)}` }, { status: 500 });
  }
}
