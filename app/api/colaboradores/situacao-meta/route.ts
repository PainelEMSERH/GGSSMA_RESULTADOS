import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API para salvar/consultar situação do colaborador para fins de meta
 * Situações que excluem da meta: DEMITIDO_2026_SEM_EPI, DEMITIDO_2025_SEM_EPI, EXCLUIDO_META
 */
export async function POST(req: NextRequest) {
  try {
    const { cpf, situacao, observacao } = await req.json();
    
    if (!cpf || !situacao) {
      return NextResponse.json({ ok: false, error: 'CPF e situação são obrigatórios' }, { status: 400 });
    }
    
    const cpfLimpo = String(cpf).replace(/\D/g, '').slice(-11);
    if (cpfLimpo.length !== 11) {
      return NextResponse.json({ ok: false, error: 'CPF inválido' }, { status: 400 });
    }
    
    // Cria tabela se não existir
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS colaborador_situacao_meta (
        id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
        cpf TEXT NOT NULL,
        situacao TEXT NOT NULL,
        observacao TEXT,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(cpf)
      );
      CREATE INDEX IF NOT EXISTS idx_csm_cpf ON colaborador_situacao_meta(cpf);
    `);
    
    // Salva ou atualiza
    await prisma.$executeRawUnsafe(`
      INSERT INTO colaborador_situacao_meta (cpf, situacao, observacao)
      VALUES ($1, $2, $3)
      ON CONFLICT (cpf) 
      DO UPDATE SET 
        situacao = EXCLUDED.situacao,
        observacao = EXCLUDED.observacao,
        atualizado_em = NOW()
    `, cpfLimpo, situacao, observacao || null);
    
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[colaboradores/situacao-meta] Erro:', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

/**
 * GET: Consulta situação de um ou mais colaboradores
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const cpf = url.searchParams.get('cpf');
    const cpfs = url.searchParams.get('cpfs'); // Lista separada por vírgula
    
    // Cria tabela se não existir
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS colaborador_situacao_meta (
        id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
        cpf TEXT NOT NULL,
        situacao TEXT NOT NULL,
        observacao TEXT,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(cpf)
      );
      CREATE INDEX IF NOT EXISTS idx_csm_cpf ON colaborador_situacao_meta(cpf);
    `);
    
    if (cpf) {
      const cpfLimpo = String(cpf).replace(/\D/g, '').slice(-11);
      const result = await prisma.$queryRawUnsafe<any[]>(`
        SELECT cpf, situacao, observacao, atualizado_em
        FROM colaborador_situacao_meta
        WHERE cpf = $1
      `, cpfLimpo);
      
      return NextResponse.json({ 
        ok: true, 
        situacao: result[0] || null 
      });
    }
    
    if (cpfs) {
      const cpfsList = String(cpfs).split(',').map(c => String(c).replace(/\D/g, '').slice(-11)).filter(c => c.length === 11);
      if (cpfsList.length === 0) {
        return NextResponse.json({ ok: true, situacoes: {} });
      }
      
      const result = await prisma.$queryRawUnsafe<any[]>(`
        SELECT cpf, situacao, observacao, atualizado_em
        FROM colaborador_situacao_meta
        WHERE cpf = ANY($1::text[])
      `, cpfsList);
      
      const map: Record<string, any> = {};
      for (const r of result) {
        map[r.cpf] = {
          situacao: r.situacao,
          observacao: r.observacao,
          atualizado_em: r.atualizado_em,
        };
      }
      
      return NextResponse.json({ ok: true, situacoes: map });
    }
    
    return NextResponse.json({ ok: true, situacoes: {} });
  } catch (e: any) {
    console.error('[colaboradores/situacao-meta] Erro GET:', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
