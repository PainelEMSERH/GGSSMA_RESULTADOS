'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

type Toast = { id: string; message: string; type: 'success' | 'error' | 'info' };
function ToastList({ toasts, remove }: { toasts: Toast[]; remove: (id: string) => void }) {
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2" role="region" aria-label="Notificações">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg min-w-[300px] max-w-md ${
            t.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200' :
            t.type === 'error' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200' :
            'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" aria-hidden />}
          {t.type === 'error' && <XCircle className="w-5 h-5 flex-shrink-0" aria-hidden />}
          {t.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" aria-hidden />}
          <span className="text-sm font-medium flex-1">{t.message}</span>
          <button type="button" onClick={() => remove(t.id)} className="text-current opacity-70 hover:opacity-100" aria-label="Fechar notificação">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

type Role = 'admin' | 'user';

type UsuarioRow = {
  id: string;
  clerkUserId: string;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
};

type ListResponse =
  | {
      ok: true;
      users: UsuarioRow[];
      regionais: []; // Always empty
      unidades: []; // Always empty
    }
  | { ok: false; error?: string };

const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  user: 'Usuário',
};

const fieldClass =
  'w-full px-3 py-2 rounded-lg border border-border bg-card text-xs text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent';

export default function AdminUsersClient() {
  const [users, setUsers] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [verifyResults, setVerifyResults] = useState<Record<string, { verified: boolean; message: string; issues: string[] }>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts((p) => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 5000);
  };
  const removeToast = (id: string) => setToasts((p) => p.filter((x) => x.id !== id));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const r = await fetch('/api/admin/users/list');
        const json: ListResponse = await r.json();
        if (!r.ok || !('ok' in json) || !json.ok) {
          if (!cancelled)
            setError('Não foi possível carregar a lista de usuários.');
          return;
        }
        if (!cancelled) {
          setUsers(json.users || []);
        }
      } catch (e) {
        if (!cancelled)
          setError('Não foi possível carregar a lista de usuários.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateUser(id: string, patch: Partial<UsuarioRow>) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              ...patch,
            }
          : u,
      ),
    );
  }

  async function saveUser(row: UsuarioRow) {
    const payload = {
      id: row.id,
      role: row.role,
      ativo: row.ativo,
    };
    const newSet = new Set(savingIds);
    newSet.add(row.id);
    setSavingIds(newSet);
    try {
      const r = await fetch('/api/admin/users/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        showToast(
          json?.error ||
            'Não foi possível salvar as permissões desse usuário.',
          'error'
        );
      } else if (json.user) {
        updateUser(row.id, json.user);
        showToast('Permissões salvas com sucesso.', 'success');
      }
    } catch (e) {
      showToast('Erro inesperado ao salvar. Tente novamente.', 'error');
    } finally {
      const s2 = new Set(newSet);
      s2.delete(row.id);
      setSavingIds(s2);
    }
  }

  async function verifyUser(row: UsuarioRow) {
    const newSet = new Set(verifyingIds);
    newSet.add(row.id);
    setVerifyingIds(newSet);
    try {
      const r = await fetch('/api/admin/users/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, clerkUserId: row.clerkUserId }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        alert(
          json?.error ||
            'Não foi possível verificar esse usuário.',
        );
      } else {
        setVerifyResults((prev) => ({
          ...prev,
          [row.id]: {
            verified: json.verified || false,
            message: json.message || '',
            issues: json.issues || [],
          },
        }));
        
        if (json.verified) {
          showToast(json.message || 'Usuário verificado com sucesso!', 'success');
        } else {
          const issuesText = json.issues?.length
            ? ' Problemas: ' + json.issues.map((i: string) => i).join('; ')
            : '';
          showToast((json.message || 'Verificação concluída com problemas.') + issuesText, 'error');
        }
      }
    } catch (e) {
      showToast('Erro inesperado ao verificar. Tente novamente.', 'error');
    } finally {
      const s2 = new Set(newSet);
      s2.delete(row.id);
      setVerifyingIds(s2);
    }
  }

  if (loading) {
    return (
      <div className="mt-6">
        <h2 className="text-sm font-semibold mb-1">Usuários &amp; permissões</h2>
        <p className="text-xs text-muted mb-3">
          Carregando lista de usuários cadastrados...
        </p>
        <div className="rounded-xl border border-border bg-panel p-4 text-xs text-muted">
          Carregando...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6">
        <h2 className="text-sm font-semibold mb-1">Usuários &amp; permissões</h2>
        <p className="text-xs text-muted mb-3">
          Configuração detalhada do que cada usuário pode ver no sistema.
        </p>
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 p-4 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="mt-6">
        <h2 className="text-sm font-semibold mb-1">Usuários &amp; permissões</h2>
        <p className="text-xs text-muted mb-3">
          Assim que novos usuários fizerem login, eles aparecerão aqui para que você
          consiga definir o papel (admin ou usuário).
        </p>
        <div className="rounded-xl border border-border bg-panel p-4 text-xs text-muted">
          Nenhum usuário encontrado ainda. Peça para os usuários acessarem o sistema pelo menos
          uma vez para aparecerem aqui.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold mb-1">Usuários &amp; permissões</h2>
      <p className="text-xs text-muted mb-3">
        Defina o papel de cada pessoa. As permissões
        passam a valer em todas as telas após o salvamento.
      </p>
      <ToastList toasts={toasts} remove={removeToast} />
      <div className="rounded-xl border border-border bg-panel p-4 overflow-x-auto">
        <table className="min-w-full text-[11px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
              <th className="px-2 py-1 text-left">Nome</th>
              <th className="px-2 py-1 text-left">E-mail</th>
              <th className="px-2 py-1 text-left">Papel</th>
              <th className="px-2 py-1 text-center">Ativo</th>
              <th className="px-2 py-1 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSaving = savingIds.has(u.id);
              return (
                <tr
                  key={u.id}
                  className="border-b border-border/60 last:border-0 align-top"
                >
                  <td className="px-2 py-1 whitespace-nowrap max-w-[180px]">
                    <div className="truncate" title={u.nome}>
                      {u.nome || '—'}
                    </div>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap max-w-[220px]">
                    <div className="truncate" title={u.email}>
                      {u.email}
                    </div>
                  </td>
                  <td className="px-2 py-1 min-w-[140px]">
                    <select
                      className={fieldClass}
                      value={u.role}
                      onChange={(e) =>
                        updateUser(u.id, { role: e.target.value as Role })
                      }
                    >
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={u.ativo}
                      onChange={(e) =>
                        updateUser(u.id, { ativo: e.target.checked })
                      }
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <div className="flex items-center gap-1.5 justify-center">
                      <button
                        onClick={() => verifyUser(u)}
                        disabled={verifyingIds.has(u.id)}
                        className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-bg disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Verificar usuário ${u.nome}`}
                      >
                        {verifyingIds.has(u.id) ? 'Verificando...' : 'Verificar'}
                      </button>
                      <button
                        onClick={() => saveUser(u)}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center rounded-lg bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Salvar alterações do usuário ${u.nome}`}
                      >
                        {isSaving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
