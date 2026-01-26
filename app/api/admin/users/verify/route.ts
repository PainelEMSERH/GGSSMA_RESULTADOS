import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROOT_ADMIN_EMAIL = 'jonathan.alves@emserh.ma.gov.br';

async function ensureAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false as const, status: 401, reason: 'UNAUTHENTICATED' as const };
  }
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';

  if (!email) {
    return { ok: false as const, status: 403, reason: 'FORBIDDEN' as const };
  }

  if (email === ROOT_ADMIN_EMAIL) {
    return { ok: true as const, email };
  }

  try {
    const dbUser = await prisma.usuario.findUnique({
      where: { email },
    });
    if (dbUser && dbUser.role === 'admin' && dbUser.ativo) {
      return { ok: true as const, email };
    }
  } catch (e) {
    console.error('[admin/users/verify.ensureAdmin] erro ao consultar Usuario', e);
  }

  return { ok: false as const, status: 403, reason: 'FORBIDDEN' as const };
}

export async function POST(req: Request) {
  const check = await ensureAdmin();
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.status },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400 },
    );
  }

  const { id, clerkUserId } = body || {};
  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'MISSING_ID' },
      { status: 400 },
    );
  }

  try {
    const dbUser = await prisma.usuario.findUnique({
      where: { id },
      include: {
        regional: true,
        unidade: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({
        ok: true,
        verified: false,
        message: 'Usuário não encontrado no banco de dados.',
        issues: ['Usuário não existe no banco de dados'],
      });
    }

    const issues: string[] = [];
    let clerkUser = null;

    // Verifica se o usuário existe no Clerk
    if (dbUser.clerkUserId) {
      try {
        const client = await clerkClient();
        clerkUser = await client.users.getUser(dbUser.clerkUserId);
        
        // Verifica se o email está sincronizado
        const clerkEmail = clerkUser.emailAddresses?.[0]?.emailAddress?.toLowerCase() || '';
        if (clerkEmail && clerkEmail !== dbUser.email.toLowerCase()) {
          issues.push(`Email no Clerk (${clerkEmail}) difere do email no banco (${dbUser.email})`);
        }

        // Verifica se o nome está sincronizado
        const clerkName = clerkUser.fullName || clerkUser.username || '';
        if (clerkName && clerkName !== dbUser.nome) {
          issues.push(`Nome no Clerk (${clerkName}) difere do nome no banco (${dbUser.nome})`);
        }
      } catch (e: any) {
        issues.push(`Usuário não encontrado no Clerk: ${e?.message || String(e)}`);
      }
    } else {
      issues.push('Usuário não possui clerkUserId associado');
    }

    // Verifica consistência das permissões
    if (dbUser.role === 'admin' && (dbUser.regionalId || dbUser.unidadeId)) {
      issues.push('Usuário admin não deve ter Regional ou Unidade definida');
    }

    if (dbUser.role === 'regional' && dbUser.unidadeId) {
      issues.push('Usuário regional não deve ter Unidade definida');
    }

    if ((dbUser.role === 'unidade' || dbUser.role === 'operador') && !dbUser.unidadeId) {
      issues.push('Usuário de unidade/operador deve ter Unidade definida');
    }

    const verified = issues.length === 0;
    const message = verified
      ? 'Usuário verificado com sucesso. Todas as informações estão corretas.'
      : `Encontradas ${issues.length} inconsistência(ões).`;

    return NextResponse.json({
      ok: true,
      verified,
      message,
      issues,
      user: {
        id: dbUser.id,
        nome: dbUser.nome,
        email: dbUser.email,
        role: dbUser.role,
        ativo: dbUser.ativo,
        regionalId: dbUser.regionalId,
        regionalNome: dbUser.regional?.nome || null,
        unidadeId: dbUser.unidadeId,
        unidadeNome: dbUser.unidade?.nome || null,
        clerkUserId: dbUser.clerkUserId,
        clerkExists: !!clerkUser,
      },
    });
  } catch (e) {
    console.error('[admin/users/verify] erro ao verificar usuário', e);
    return NextResponse.json(
      {
        ok: false,
        error: 'Erro ao verificar usuário',
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
