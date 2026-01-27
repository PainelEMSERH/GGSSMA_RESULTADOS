'use client';

import React, { useCallback, useEffect, useState } from 'react';

type Preferencias = {
  regionalPadrao: string | null;
  unidadePadrao: string | null;
  itensPorPagina: number | null;
};

const ITENS_POR_PAGINA_OPCOES = [25, 50, 100];

export default function ConfiguracoesPreferencias() {
  const [pref, setPref] = useState<Preferencias>({
    regionalPadrao: null,
    unidadePadrao: null,
    itensPorPagina: null,
  });
  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<Array<{ unidade: string; regional: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [prefRes, optsRes] = await Promise.all([
        fetch('/api/preferencias', { cache: 'no-store' }),
        fetch('/api/entregas/options', { cache: 'no-store' }),
      ]);
      const prefJson = await prefRes.json();
      const optsJson = await optsRes.json();
      if (prefJson?.ok && prefJson.preferencias) {
        setPref({
          regionalPadrao: prefJson.preferencias.regionalPadrao ?? null,
          unidadePadrao: prefJson.preferencias.unidadePadrao ?? null,
          itensPorPagina: prefJson.preferencias.itensPorPagina ?? null,
        });
      }
      if (Array.isArray(optsJson.regionais)) setRegionais(optsJson.regionais);
      if (Array.isArray(optsJson.unidades)) setUnidades(optsJson.unidades);
    } catch (e) {
      setMessage('Erro ao carregar preferências.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (next: Preferencias) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/preferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const json = await res.json();
      if (json?.ok) {
        setPref(json.preferencias ?? next);
        setMessage('Preferências salvas.');
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage(json?.error || 'Erro ao salvar.');
      }
    } catch (e) {
      setMessage('Erro ao salvar preferências.');
    } finally {
      setSaving(false);
    }
  }, []);

  const handleRegional = (value: string) => {
    const v = value || null;
    const next = { ...pref, regionalPadrao: v, unidadePadrao: v ? pref.unidadePadrao : null };
    setPref(next);
    save(next);
  };

  const handleUnidade = (value: string) => {
    const v = value || null;
    const next = { ...pref, unidadePadrao: v };
    setPref(next);
    save(next);
  };

  const handleItensPorPagina = (value: string) => {
    const n = value ? parseInt(value, 10) : null;
    const v = n && ITENS_POR_PAGINA_OPCOES.includes(n) ? n : null;
    const next = { ...pref, itensPorPagina: v };
    setPref(next);
    save(next);
  };

  const unidadesFiltradas = pref.regionalPadrao
    ? unidades.filter(
        (u) => (u.regional || '').toString().toUpperCase() === (pref.regionalPadrao || '').toUpperCase()
      )
    : unidades;

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-bg/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold">Padrões de exibição</h2>
        <p className="text-xs text-muted">
          Definições que impactam todas as telas (Alterdata, Entregas, OS, Estoque).
        </p>
        <div className="text-xs text-muted flex items-center gap-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Carregando…
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-bg/40 p-4 space-y-3">
      <h2 className="text-sm font-semibold">Padrões de exibição</h2>
      <p className="text-xs text-muted">
        Definições que impactam todas as telas (Alterdata, Entregas, OS, Estoque). Suas escolhas são salvas automaticamente.
      </p>
      <div className="space-y-3 text-xs">
        <div>
          <label className="font-medium text-muted block mb-1">Regional padrão</label>
          <select
            aria-label="Regional padrão"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            value={pref.regionalPadrao ?? ''}
            onChange={(e) => handleRegional(e.target.value)}
            disabled={saving}
          >
            <option value="">Todas / Coordenador</option>
            {regionais.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-medium text-muted block mb-1">Unidade padrão</label>
          <select
            aria-label="Unidade padrão"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            value={pref.unidadePadrao ?? ''}
            onChange={(e) => handleUnidade(e.target.value)}
            disabled={saving || !pref.regionalPadrao}
          >
            <option value="">Todas</option>
            {unidadesFiltradas.map((u) => (
              <option key={u.unidade} value={u.unidade}>{u.unidade}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-medium text-muted block mb-1">Itens por página</label>
          <select
            aria-label="Itens por página"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            value={pref.itensPorPagina ?? ''}
            onChange={(e) => handleItensPorPagina(e.target.value)}
            disabled={saving}
          >
            <option value="">Padrão (25)</option>
            {ITENS_POR_PAGINA_OPCOES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>
      {saving && (
        <p className="text-[11px] text-muted flex items-center gap-1" role="status" aria-live="polite">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Salvando…
        </p>
      )}
      {message && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}
