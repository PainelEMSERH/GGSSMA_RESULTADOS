import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import AdminUsersClient from '@/components/admin/AdminUsersClient';
import AdminLogsClient from '@/components/admin/AdminLogsClient';
import ImportarAlterdataClient from '@/components/admin/ImportarAlterdataClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROOT_ADMIN_EMAIL = 'jonathan.alves@emserh.ma.gov.br';

async function ensureAdmin() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';

  if (!email) {
    redirect('/');
  }

  if (email === ROOT_ADMIN_EMAIL) {
    // Garante presença na tabela Usuario como admin
    try {
      await prisma.usuario.upsert({
        where: { email },
        update: {
          nome: user?.fullName || user?.username || email,
          ativo: true,
          role: 'admin',
          clerkUserId: user?.id || '',
        },
        create: {
          id: user?.id || email,
          email,
          nome: user?.fullName || user?.username || email,
          ativo: true,
          role: 'admin',
          clerkUserId: user?.id || '',
        },
      });
    } catch (e) {
      console.error('[admin.ensureAdmin] erro ao garantir root admin', e);
    }
    return {
      email,
      isRoot: true as const,
      nome: user?.fullName || user?.username || email,
    };
  }

  try {
    const dbUser = await prisma.usuario.findUnique({
      where: { email },
      include: {
        regional: true,
        unidade: true,
      },
    });
    if (dbUser && dbUser.role === 'admin' && dbUser.ativo) {
      return {
        email,
        isRoot: false as const,
        nome: dbUser.nome || email,
      };
    }
  } catch (e) {
    console.error('[admin.ensureAdmin] erro ao consultar Usuario', e);
  }

  redirect('/');
}

export default async function Page() {
  const admin = await ensureAdmin();

  const totalUsuarios = await prisma.usuario.count().catch(() => 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Administração do sistema</h1>
        <p className="text-xs text-muted">
          Logado como <span className="font-medium">{admin.email}</span>
          {admin.isRoot && ' (root admin)'}.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-panel p-4 shadow-sm flex items-center justify-between">
        <div className="text-sm text-muted">
          Usuários cadastrados:{' '}
          <span className="font-semibold text-text">{totalUsuarios}</span>
        </div>
      </div>

      {admin.isRoot && (
        <div className="space-y-4">
          <ImportarAlterdataClient />
          <div className="mt-6">
            <a
              href="/admin/importar-bases"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
            >
              📥 Importar Outras Bases (SPCI, CIPA, Acidentes, OS)
            </a>
          </div>
        </div>
      )}

      <AdminUsersClient />

      <AdminLogsClient />
    </div>
  );
}
