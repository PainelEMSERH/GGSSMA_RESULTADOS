export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-1">Configurações do sistema</h1>
        <p className="text-sm text-muted">
          Centro de controle da plataforma: parâmetros globais, integrações, metas e segurança de acesso.
        </p>
      </div>

      {/* Primeira linha: uso diário */}
      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-border bg-bg/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold">Padrões de exibição</h2>
          <p className="text-xs text-muted">
            Definições que impactam todas as telas (Alterdata, Entregas, OS, Estoque).
          </p>
          <div className="space-y-2 text-xs text-muted">
            <p className="flex items-center justify-between">
              <span>Regional padrão</span>
              <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] bg-panel">
                Coordenador
              </span>
            </p>
            <p className="flex items-center justify-between">
              <span>Unidade padrão</span>
              <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] bg-panel">
                Todas
              </span>
            </p>
            <p className="flex items-center justify-between">
              <span>Itens por página</span>
              <span className="inline-flex gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] bg-panel">
                25 • 50 • 100
              </span>
            </p>
            <p className="text-[11px] text-muted mt-2">
              Futuro: esses campos podem virar seleção por usuário (preferências salvas).
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-bg/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold">Integrações &amp; dados</h2>
          <p className="text-xs text-muted">
            Status das integrações principais e fluxo de atualização de base.
          </p>
          <div className="space-y-2 text-xs text-muted">
            <p>• Origem dos colaboradores: Alterdata (planilha / ETL Neon)</p>
            <p>• Views rápidas de EPI: <span className="font-mono text-[11px]">vw_entregas_epi_unidade</span></p>
            <p>• Importações em massa: módulo Admin &rarr; Importar bases</p>
            <p className="text-[11px] text-muted mt-1">
              Recomendado: manter um calendário de atualização (mensal ou sempre que houver grande
              movimentação de pessoal).
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-bg/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold">Metas &amp; períodos</h2>
          <p className="text-xs text-muted">
            Parâmetros usados para metas de EPI, OS, acidentes e SPCI.
          </p>
          <div className="space-y-2 text-xs text-muted">
            <p>• Ano base de referência: 2026 (colaboradores ativos / demissão &ge; 2026)</p>
            <p>• Metas de EPI: obrigatórios por função (mapa Alterdata &rarr; EPIs)</p>
            <p>• Metas de OS: 100% dos ativos com OS assinada em 2026</p>
            <p>• Acidentes / SPCI: metas anuais de redução e inspeções mensais</p>
          </div>
        </section>
      </div>

      {/* Segunda linha: segurança e governança */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-bg/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold">Segurança &amp; acesso</h2>
          <p className="text-xs text-muted">
            Controle de quem enxerga o quê dentro da plataforma.
          </p>
          <ul className="space-y-1 text-xs text-muted list-disc list-inside">
            <li>Autenticação via Clerk (SSO / e-mail corporativo).</li>
            <li>Perfis: admin, gestor regional, gestor de unidade, operador.</li>
            <li>Escopo filtrado por regional/unidade em todas as telas de dados.</li>
            <li>
              Gestão de usuários e permissões em:{' '}
              <span className="font-semibold">Admin &rarr; Usuários &amp; permissões</span>.
            </li>
          </ul>
          <p className="text-[11px] text-muted mt-2">
            Boas práticas: revisar perfis de acesso periodicamente e inativar contas que não
            utilizam mais o sistema.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-bg/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold">Auditoria &amp; trilha</h2>
          <p className="text-xs text-muted">
            Visão geral de registros críticos que devem sempre ter trilha de auditoria.
          </p>
          <ul className="space-y-1 text-xs text-muted list-disc list-inside">
            <li>Importações de base Alterdata (colaboradores) com lote, arquivo e quantidade.</li>
            <li>Alterações de permissões de usuários (papel, regional, unidade, ativo/inativo).</li>
            <li>Registros de entregas de EPI e confirmação de Ordem de Serviço.</li>
          </ul>
          <p className="text-[11px] text-muted mt-2">
            Consulta detalhada disponível em:{' '}
            <span className="font-semibold">Admin &rarr; Últimas ações</span>.
          </p>
        </section>
      </div>

      {/* Checklist final */}
      <div className="rounded-xl border border-dashed border-border/60 bg-bg/30 p-4 text-xs text-muted space-y-2">
        <p className="font-semibold text-[12px] text-text">Checklist de configuração recomendada</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Confirmar regionais e unidades cadastradas no módulo Admin.</li>
          <li>Importar a base Alterdata atualizada e validar totais de colaboradores.</li>
          <li>Definir perfis de acesso para todos os gestores (regional / unidade).</li>
          <li>Validar metas de EPI, OS, acidentes e SPCI para o ano corrente.</li>
        </ul>
        <p className="text-[11px]">
          Esses blocos podem ser ligados a tabelas e APIs específicas (preferências por usuário,
          chaves de integração, metas por ano) sem necessidade de alterar o visual da página.
        </p>
      </div>
    </div>
  );
}
