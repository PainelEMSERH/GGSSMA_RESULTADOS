import { loadContext } from '@/lib/chat/ai-handler';
import {
  queryAcidentes,
  queryColaboradorMaisVelho,
  queryColaboradorRecenteUnidade,
  queryColaboradoresUnidade,
  queryDemitidos,
  queryEPIEntregue,
  queryFuncaoColaborador,
  queryUltimaAcidentada,
  queryUltimaAtualizacaoAlterdata,
  queryUnidadeExiste,
} from '@/lib/chat/query-handlers';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type ToolResult = {
  ok: boolean;
  tool: string;
  data: any;
};

function hasOpenAIKey() {
  return !!process.env.OPENAI_API_KEY;
}

function normalizeText(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Executa uma ferramenta (consulta) baseada em nome + argumentos.
 * Observação: para máxima robustez, os tools aceitam `question` e usam os parsers/fuzzy internos.
 */
async function runTool(toolName: string, args: any): Promise<ToolResult> {
  const question = String(args?.question || '').trim();

  switch (toolName) {
    case 'unidade_existe': {
      const data = await queryUnidadeExiste(question);
      return { ok: true, tool: toolName, data };
    }
    case 'colaboradores_unidade': {
      const data = await queryColaboradoresUnidade(question);
      return { ok: true, tool: toolName, data };
    }
    case 'epi_entregue': {
      const data = await queryEPIEntregue(question);
      return { ok: true, tool: toolName, data };
    }
    case 'demitidos_periodo': {
      const data = await queryDemitidos(question);
      return { ok: true, tool: toolName, data };
    }
    case 'alterdata_ultima_atualizacao': {
      const data = await queryUltimaAtualizacaoAlterdata();
      return { ok: true, tool: toolName, data };
    }
    case 'acidentes_periodo_regional': {
      const data = await queryAcidentes(question);
      return { ok: true, tool: toolName, data };
    }
    case 'ultima_acidentada': {
      const data = await queryUltimaAcidentada();
      return { ok: true, tool: toolName, data };
    }
    case 'colaborador_mais_velho': {
      const data = await queryColaboradorMaisVelho();
      return { ok: true, tool: toolName, data };
    }
    case 'colaborador_recente_unidade': {
      const data = await queryColaboradorRecenteUnidade(question);
      return { ok: true, tool: toolName, data };
    }
    case 'funcao_colaborador': {
      const data = await queryFuncaoColaborador(question);
      return { ok: true, tool: toolName, data };
    }
    default:
      return { ok: false, tool: toolName, data: { error: 'tool desconhecida' } };
  }
}

export async function answerWithToolCalling(input: {
  question: string;
  messages: ChatMessage[];
}): Promise<{ ok: true; answer: string; source: string; data?: any } | null> {
  if (!hasOpenAIKey()) return null;

  const question = String(input.question || '').trim();
  const messages = Array.isArray(input.messages) ? input.messages.slice(-12) : [];
  const context = await loadContext();

  const qLower = normalizeText(question);

  // REGRAS DURAS antes da IA decidir:
  // 1) Se a pergunta é claramente "quantos colaboradores..." -> sempre usar colaboradores_unidade
  if (
    (qLower.includes('colaborador') || qLower.includes('colaborad')) &&
    (qLower.includes('quantos') || qLower.includes('qtd') || qLower.includes('quantidade') || qLower.includes('tem '))
  ) {
    const data = await queryColaboradoresUnidade(question);
    if (!data.unidade) {
      return {
        ok: true,
        answer: 'Me diz o nome completo da unidade (por exemplo: "Quantos colaboradores ativos tem no HOSPITAL MACRORREGIONAL DRA RUTH NOLETO?").',
        source: 'rule',
        data,
      };
    }
    return {
      ok: true,
      answer: `Na unidade "${data.unidade}" há ${data.total} colaborador(es) ativo(s) neste momento.`,
      source: 'rule+data',
      data,
    };
  }

  // Ferramentas disponíveis (intenção → query handler)
  const tools = [
    {
      type: 'function',
      function: {
        name: 'unidade_existe',
        description: 'Verifica se uma unidade existe (com fuzzy e sugestões).',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string' } },
          required: ['question'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'colaboradores_unidade',
        description: 'Conta colaboradores ativos de uma unidade (ex.: UPA Imperatriz).',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string' } },
          required: ['question'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'epi_entregue',
        description: 'Soma entregas de um EPI (ex.: N95) em unidade/período.',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string' } },
          required: ['question'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'demitidos_periodo',
        description: 'Conta demitidos por mês/ano.',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string' } },
          required: ['question'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'alterdata_ultima_atualizacao',
        description: 'Retorna data/hora da última atualização/import do Alterdata.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'acidentes_periodo_regional',
        description: 'Conta acidentes em uma ou mais regionais no período.',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string' } },
          required: ['question'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ultima_acidentada',
        description: 'Retorna o nome da última acidentada registrada.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'colaborador_mais_velho',
        description: 'Retorna o colaborador mais antigo (maior tempo de admissão).',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'colaborador_recente_unidade',
        description: 'Retorna quem entrou mais recentemente em uma unidade.',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string' } },
          required: ['question'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'funcao_colaborador',
        description: 'Retorna função/cargo de um colaborador pelo nome.',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string' } },
          required: ['question'],
        },
      },
    },
  ] as any[];

  const system = `
Você é a Assistente Virtual da EMSERH.

Regras:
- Fale em PT-BR, natural e direto.
- Quando a pergunta exigir dados, CHAME UMA TOOL adequada.
- Se faltar informação (ex.: unidade, período), peça UMA pergunta objetiva para completar.
- Você tem acesso a uma lista grande de unidades/regionais (use fuzzy e sugira opções quando necessário).

Contexto (resumo):
- Regionais: ${context.regionais.join(', ')}
- Unidades conhecidas (amostra): ${context.unidades.slice(0, 20).join(' | ')}
`.trim();

  // 1) Primeira chamada: modelo decide se chama tool
  const first = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        ...messages,
        { role: 'user', content: question },
      ],
      tools,
      tool_choice: 'auto',
      max_tokens: 700,
    }),
  });

  if (!first.ok) return null;
  const firstJson: any = await first.json();
  const msg = firstJson?.choices?.[0]?.message;

  const toolCalls = msg?.tool_calls;
  if (!toolCalls || toolCalls.length === 0) {
    const content = String(msg?.content || '').trim();
    if (!content) return null;
    return { ok: true, answer: content, source: 'ai' };
  }

  // Executa a 1ª tool (mantém simples e previsível)
  const call = toolCalls[0];
  const toolName = String(call?.function?.name || '');
  let args: any = {};
  try {
    args = JSON.parse(call?.function?.arguments || '{}');
  } catch {
    args = { question };
  }
  if (!args?.question && toolName !== 'alterdata_ultima_atualizacao' && toolName !== 'ultima_acidentada' && toolName !== 'colaborador_mais_velho') {
    args.question = question;
  }

  const toolResult = await runTool(toolName, args);

  // 2) Segunda chamada: modelo redige resposta final com base no resultado
  const second = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        { role: 'system', content: system },
        ...messages,
        { role: 'user', content: question },
        {
          role: 'assistant',
          content: null,
          tool_calls: toolCalls,
        },
        {
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(toolResult),
        },
      ],
      max_tokens: 700,
    }),
  });

  if (!second.ok) return null;
  const secondJson: any = await second.json();
  const finalText = String(secondJson?.choices?.[0]?.message?.content || '').trim();
  if (!finalText) return null;

  return {
    ok: true,
    answer: finalText,
    source: 'ai+tools',
    data: toolResult,
  };
}

