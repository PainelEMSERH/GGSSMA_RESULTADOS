export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { calcularStatus } from '@/lib/spci/utils';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/**
 * API de Chat para responder perguntas sobre dados do site
 * Suporta perguntas sobre: extintores (SPCI), entregas, estoque, acidentes, colaboradores, etc.
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

    // Normaliza pergunta para análise
    const qLower = lastQuestion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const qUpper = lastQuestion.toUpperCase();

    // 1) EXTINTORES (SPCI)
    if (qLower.includes('extintor') || qLower.includes('spci')) {
      const unidadeMatch = qLower.match(/unidade\s+([^?]+)|([^?]+)\s+unidade/i);
      const unidade = unidadeMatch ? (unidadeMatch[1] || unidadeMatch[2] || '').trim() : null;
      const regionalMatch = qLower.match(/regional\s+([^?]+)|([^?]+)\s+regional/i);
      const regional = regionalMatch ? (regionalMatch[1] || regionalMatch[2] || '').trim() : null;
      
      if (qLower.includes('quantos') || qLower.includes('total') || qLower.includes('quantidade')) {
        try {
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

          return NextResponse.json({
            ok: true,
            answer: unidade 
              ? `Na unidade "${unidade}" há ${total} extintor(es): ${dentroPrazo} dentro do prazo e ${vencidos} vencido(s).`
              : regional
              ? `Na regional "${regional}" há ${total} extintor(es): ${dentroPrazo} dentro do prazo e ${vencidos} vencido(s).`
              : `Total de extintores: ${total} (${dentroPrazo} dentro do prazo, ${vencidos} vencidos).`,
            data: { total, vencidos, dentro_prazo: dentroPrazo },
          });
        } catch (e: any) {
          return NextResponse.json({ ok: false, error: `Erro ao consultar extintores: ${e?.message}` }, { status: 500 });
        }
      }
      
      if (qLower.includes('vencido') || qLower.includes('vencimento')) {
        try {
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
            ? await prisma.$queryRawUnsafe(`SELECT "Unidade", "Localização", "Classe", "Última recarga" FROM spci_planilha ${whereSql} LIMIT 20`, ...queryParams)
            : await prisma.$queryRawUnsafe(`SELECT "Unidade", "Localização", "Classe", "Última recarga" FROM spci_planilha ${whereSql} LIMIT 20`);

          const vencidos: any[] = [];
          for (const row of rows) {
            const calculo = calcularStatus(row['Última recarga']);
            if (calculo.status === 'VENCIDO') {
              vencidos.push({
                unidade: row['Unidade'],
                localizacao: row['Localização'],
                classe: row['Classe'],
                ultima_recarga: row['Última recarga'],
                data_limite: calculo.dataLimite,
              });
            }
          }

          if (vencidos.length === 0) {
            return NextResponse.json({
              ok: true,
              answer: unidade ? `Nenhum extintor vencido encontrado na unidade "${unidade}".` : regional ? `Nenhum extintor vencido encontrado na regional "${regional}".` : 'Nenhum extintor vencido encontrado.',
            });
          }

          const lista = vencidos.map((r: any) => {
            const dataLimite = r.data_limite ? new Date(r.data_limite).toLocaleDateString('pt-BR') : 'N/A';
            return `• ${r.unidade} - ${r.localizacao || 'N/A'} (${r.classe || 'N/A'}, última recarga: ${r.ultima_recarga || 'N/A'})`;
          }).join('\n');

          return NextResponse.json({
            ok: true,
            answer: `Extintores vencidos encontrados:\n\n${lista}${vencidos.length >= 20 ? '\n\n(mostrando os 20 primeiros)' : ''}`,
            data: { count: vencidos.length, items: vencidos },
          });
        } catch (e: any) {
          return NextResponse.json({ ok: false, error: `Erro: ${e?.message}` }, { status: 500 });
        }
      }
    }

    // 2) ENTREGAS
    if ((qLower.includes('entrega') && !qLower.includes('ordem')) || (qLower.includes('epi') && qLower.includes('entreg'))) {
      const unidadeMatch = qLower.match(/unidade\s+([^?]+)|([^?]+)\s+unidade/i);
      const unidade = unidadeMatch ? (unidadeMatch[1] || unidadeMatch[2] || '').trim() : null;
      const regionalMatch = qLower.match(/regional\s+([^?]+)|([^?]+)\s+regional/i);
      const regional = regionalMatch ? (regionalMatch[1] || regionalMatch[2] || '').trim() : null;

      if (qLower.includes('quantos') || qLower.includes('total') || qLower.includes('quantidade')) {
        try {
          // Conta entregas do mês atual
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
          const total = rows[0]?.total || 0;
          return NextResponse.json({
            ok: true,
            answer: `${total} EPI(s) entregue(s) neste mês${regional ? ` na regional "${regional}"` : ''}${unidade ? ` na unidade "${unidade}"` : ''}.`,
            data: { total, periodo: `${mes}/${ano}` },
          });
        } catch (e: any) {
          return NextResponse.json({ ok: false, error: `Erro: ${e?.message}` }, { status: 500 });
        }
      }
    }

    // 3) ESTOQUE
    if (qLower.includes('estoque') || qLower.includes('item') || qLower.includes('epi') && qLower.includes('estoque')) {
      const unidadeMatch = qLower.match(/unidade\s+([^?]+)|([^?]+)\s+unidade/i);
      const unidade = unidadeMatch ? (unidadeMatch[1] || unidadeMatch[2] || '').trim() : null;
      const regionalMatch = qLower.match(/regional\s+([^?]+)|([^?]+)\s+regional/i);
      const regional = regionalMatch ? (regionalMatch[1] || regionalMatch[2] || '').trim() : null;

      if (qLower.includes('abaixo') || qLower.includes('mínimo') || qLower.includes('baixo') || qLower.includes('faltando')) {
        try {
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
            return NextResponse.json({
              ok: true,
              answer: unidade ? `Nenhum item abaixo do mínimo na unidade "${unidade}".` : regional ? `Nenhum item abaixo do mínimo na regional "${regional}".` : 'Nenhum item abaixo do mínimo no estoque.',
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
    }

    // 4) ACIDENTES
    if (qLower.includes('acidente')) {
      const anoMatch = qLower.match(/(\d{4})/);
      const ano = anoMatch ? parseInt(anoMatch[1], 10) : new Date().getFullYear();

      if (qLower.includes('quantos') || qLower.includes('total')) {
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
            data: data,
          });
        } catch (e: any) {
          return NextResponse.json({ ok: false, error: `Erro: ${e?.message}` }, { status: 500 });
        }
      }
    }

    // 5) COLABORADORES
    if (qLower.includes('colaborador') || qLower.includes('funcionario') || qLower.includes('funcionario') || qLower.includes('pessoa') || qLower.includes('trabalhador')) {
      const unidadeMatch = qLower.match(/unidade\s+([^?]+)|([^?]+)\s+unidade/i);
      const unidade = unidadeMatch ? (unidadeMatch[1] || unidadeMatch[2] || '').trim() : null;
      const regionalMatch = qLower.match(/regional\s+([^?]+)|([^?]+)\s+regional/i);
      const regional = regionalMatch ? (regionalMatch[1] || regionalMatch[2] || '').trim() : null;

      if (qLower.includes('quantos') || qLower.includes('total')) {
        try {
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
          const total = rows[0]?.total || 0;
          return NextResponse.json({
            ok: true,
            answer: `${total} colaborador(es) ativo(s)${regional ? ` na regional "${regional}"` : ''}${unidade ? ` na unidade "${unidade}"` : ''}.`,
            data: { total },
          });
        } catch (e: any) {
          return NextResponse.json({ ok: false, error: `Erro: ${e?.message}` }, { status: 500 });
        }
      }
    }

    // 6) ORDENS DE SERVIÇO
    if ((qLower.includes('ordem') && qLower.includes('serviço')) || qLower.includes(' os ') || qLower.match(/\bos\b/)) {
      if (qLower.includes('quantos') || qLower.includes('total') || qLower.includes('entregue') || qLower.includes('pendente')) {
        try {
          // Verifica se a tabela existe
          const tableExists: any[] = await prisma.$queryRawUnsafe(`
            SELECT EXISTS (
              SELECT 1 FROM pg_catalog.pg_class c
              JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
              WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'ordem_servico'
            ) AS exists
          `);
          
          if (!tableExists[0]?.exists) {
            return NextResponse.json({
              ok: true,
              answer: 'A tabela de ordens de serviço ainda não foi criada. Use a página de Ordens de Serviço para criar a primeira.',
            });
          }

          const rows: any[] = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*)::int AS total,
                   COUNT(CASE WHEN entregue = true THEN 1 END)::int AS entregues,
                   COUNT(CASE WHEN entregue = false OR entregue IS NULL THEN 1 END)::int AS pendentes
            FROM ordem_servico
          `);
          const data = rows[0] || { total: 0, entregues: 0, pendentes: 0 };
          return NextResponse.json({
            ok: true,
            answer: `Total de ordens de serviço: ${data.total} (${data.entregues} entregue(s), ${data.pendentes} pendente(s)).`,
            data: data,
          });
        } catch (e: any) {
          return NextResponse.json({ ok: false, error: `Erro: ${e?.message}` }, { status: 500 });
        }
      }
    }

    // Resposta padrão se não encontrou padrão conhecido
    return NextResponse.json({
      ok: true,
      answer: 'Desculpe, não entendi sua pergunta. Tente perguntar sobre:\n\n• Extintores (ex: "quantos extintores tem na unidade X?")\n• Entregas de EPI (ex: "quantas entregas foram feitas este mês?")\n• Estoque (ex: "quais itens estão abaixo do mínimo?")\n• Acidentes (ex: "quantos acidentes em 2026?")\n• Colaboradores (ex: "quantos colaboradores ativos na regional X?")\n• Ordens de serviço (ex: "quantas OS foram entregues?")',
      suggestions: [
        'Quantos extintores tem na unidade X?',
        'Quantas entregas foram feitas este mês?',
        'Quais itens estão abaixo do mínimo?',
        'Quantos acidentes em 2026?',
        'Quantos colaboradores ativos?',
      ],
    });
  } catch (e: any) {
    console.error('[chat] erro:', e);
    return NextResponse.json({ ok: false, error: `Erro interno: ${e?.message || String(e)}` }, { status: 500 });
  }
}
