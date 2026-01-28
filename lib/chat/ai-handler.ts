/**
 * Handler de IA para processar perguntas naturais usando OpenAI
 */

import { fuzzySearch } from './fuzzy-search';
import prisma from '@/lib/prisma';

export interface AIContext {
  unidades: string[];
  regionais: string[];
  unidadesMap: Map<string, string>; // unidade -> regional
}

let cachedContext: AIContext | null = null;
let contextCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Carrega contexto de unidades e regionais do banco
 */
export async function loadContext(): Promise<AIContext> {
  const now = Date.now();
  if (cachedContext && (now - contextCacheTime) < CACHE_TTL) {
    return cachedContext;
  }

  try {
    // Busca unidades e regionais do stg_unid_reg
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT 
        nmdepartamento AS unidade,
        regional_responsavel AS regional
      FROM stg_unid_reg
      WHERE nmdepartamento IS NOT NULL
        AND nmdepartamento != ''
    `);

    const unidades: string[] = [];
    const unidadesMap = new Map<string, string>();

    for (const row of rows) {
      const unidade = String(row.unidade || '').trim();
      const regional = String(row.regional || '').trim();
      if (unidade) {
        unidades.push(unidade);
        if (regional) {
          unidadesMap.set(unidade.toLowerCase(), regional);
        }
      }
    }

    // Busca regionais únicas
    const regionaisRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT regional_responsavel AS regional
      FROM stg_unid_reg
      WHERE regional_responsavel IS NOT NULL
        AND regional_responsavel != ''
    `);

    const regionais = regionaisRows.map((r: any) => String(r.regional || '').trim()).filter(Boolean);

    cachedContext = {
      unidades: [...new Set(unidades)],
      regionais: [...new Set(regionais)],
      unidadesMap,
    };
    contextCacheTime = now;

    return cachedContext;
  } catch (e) {
    console.error('[loadContext] erro:', e);
    return {
      unidades: [],
      regionais: ['NORTE', 'SUL', 'LESTE', 'CENTRO'],
      unidadesMap: new Map(),
    };
  }
}

/**
 * Encontra unidade usando busca fuzzy
 */
export async function findUnidade(query: string): Promise<{ unidade: string; regional: string } | null> {
  const context = await loadContext();
  const matches = fuzzySearch(query, context.unidades, 0.4);
  
  if (matches.length === 0) return null;
  
  const bestMatch = matches[0];
  const regional = context.unidadesMap.get(bestMatch.text.toLowerCase()) || '';
  
  return {
    unidade: bestMatch.text,
    regional: regional.toUpperCase(),
  };
}

/**
 * Encontra regional usando busca fuzzy
 */
export async function findRegional(query: string): Promise<string | null> {
  const context = await loadContext();
  const matches = fuzzySearch(query, context.regionais, 0.5);
  
  if (matches.length === 0) return null;
  return matches[0].text.toUpperCase();
}

/**
 * Processa pergunta usando OpenAI (se disponível) ou fallback para padrões
 */
export async function processWithAI(
  question: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: AIContext
): Promise<{ useAI: boolean; response?: any }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    return { useAI: false };
  }

  try {
    // Prepara contexto do sistema
    const systemContext = `Você é um assistente especializado do sistema EMSERH (Empresa Maranhense de Serviços Hospitalares).

CONTEXTO DO SISTEMA:
- O sistema gerencia dados de hospitais e unidades de saúde do Maranhão
- Há 4 regionais: NORTE, SUL, LESTE, CENTRO
- Cada regional tem várias unidades hospitalares

DADOS DISPONÍVEIS:
1. EXTINTORES (SPCI): Extintores de incêndio com controle de vencimento
   - Tabela: spci_planilha
   - Campos: "Unidade", "Regional", "Última recarga", "Localização", "Classe", "TAG"
   - Status calculado: OK, A VENCER, VENCIDO (baseado em "Última recarga")

2. ENTREGAS DE EPI: Entregas de Equipamentos de Proteção Individual
   - Tabela: epi_entregas
   - Campos: cpf, item, deliveries (JSONB com histórico)
   - Relacionado com: stg_alterdata_v2 (colaboradores)

3. ESTOQUE: Controle de estoque de itens por unidade
   - Tabela: Estoque
   - Campos: quantidade, minimo, itemId, unidadeId
   - Relacionado com: Item, Unidade

4. ACIDENTES: Registro de acidentes de trabalho
   - Tabela: Acidente
   - Campos: ano, comAfastamento, tipo, etc.

5. COLABORADORES: Dados dos colaboradores
   - Tabela: stg_alterdata_v2
   - Campos: cpf, nome, unidade_hospitalar, funcao, admissao, demissao

6. ORDENS DE SERVIÇO: Ordens de serviço
   - Tabela: ordem_servico
   - Campos: entregue, etc.

UNIDADES CONHECIDAS (exemplos):
${context.unidades.slice(0, 50).map(u => `- ${u}`).join('\n')}
${context.unidades.length > 50 ? `\n... e mais ${context.unidades.length - 50} unidades` : ''}

REGIONAIS:
${context.regionais.map(r => `- ${r}`).join('\n')}

TIPOS DE PERGUNTAS QUE VOCÊ PODE RESPONDER:
1. Colaboradores: "quantos colaboradores tem na upa de imperatriz?"
2. Meta/Planejado: "esse mês qual meu planejado de entrega de epi?"
3. EPIs entregues: "quantas máscaras n95 eu entreguei no svo de imperatriz?"
4. Demitidos: "quantos demitidos eu tenho em jan de 26?"
5. Atualização: "qual a última vez que o alterdata foi atualizado?"
6. Acidentes: "quantos acidentes eu tive esse mês na regional norte e sul?"
7. Última acidentada: "qual nome da última acidentada registrada?"
8. Colaborador mais velho: "qual colaborador mais velho da emserh?"
9. Admissão recente: "qual colaborador entrou recentemente lá na upa de imperatriz?"
10. Função: "qual função do jonathan silva alves?"

INSTRUÇÕES:
- Seja conversacional e natural
- Entenda perguntas mesmo com erros de digitação ou nomes parciais
- Exemplo: "macro ruth noleto" = "Hospital Macrorregional Ruth Noleto de Imperatriz" (Regional SUL)
- Exemplo: "upa de imperatriz" = busca fuzzy por unidades com "upa" e "imperatriz"
- Sempre responda em português brasileiro
- Se não souber algo, seja honesto
- Use dados reais quando possível
- Seja útil e prestativo
- IMPORTANTE: Quando a pergunta for sobre dados específicos (colaboradores, entregas, etc.), você deve indicar que precisa buscar no banco de dados. O sistema executará a query automaticamente.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemContext },
          ...messages.slice(-10), // Últimas 10 mensagens para contexto
          { role: 'user', content: question },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OpenAI] erro:', error);
      return { useAI: false };
    }

    const data = await response.json();
    const aiAnswer = data.choices?.[0]?.message?.content || '';

    return {
      useAI: true,
      response: {
        ok: true,
        answer: aiAnswer,
        source: 'ai',
      },
    };
  } catch (e: any) {
    console.error('[processWithAI] erro:', e);
    return { useAI: false };
  }
}
