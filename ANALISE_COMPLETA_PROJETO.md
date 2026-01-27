# Análise completa do projeto EMSERH Painel

Relatório do que **é usado** e do que **não é usado** no site atual (rotas, componentes, dependências e APIs), com base na árvore de imports e no menu do AppShell.

---

## 1. Stack e dependências (package.json)

### 1.1 Dependências **em uso**

| Pacote | Onde é usado |
|--------|--------------|
| `next` | Framework do app |
| `@clerk/nextjs` | Auth (sign-in, sign-up, middleware, layout, APIs), UserButton no AppShell |
| `react` / `react-dom` | Base React |
| `@tailwindcss/forms` | `app/globals.css` (@plugin) |
| `chart.js` | DashboardEPIClient, DoughnutChart e outros charts (via components/charts) |
| `chartjs-adapter-moment` | RealtimeChart, LineChart01/02, BarChart02/03, DoughnutChart (só os charts “antigos” que usam TimeScale) |
| `clsx` | AppShell (classes condicionais) |
| `date-fns` | components/components/Datepicker.jsx, Datepicker.jsx |
| `react-day-picker` | Datepicker (components/components e components raiz) |
| `react-transition-group` | components/utils/Transition.jsx |
| `@prisma/client` | Layout (app), admin, APIs, lib/prisma |
| `next-themes` | providers.tsx (ThemeProvider), ThemeToggle, ThemeSwitcherGeist |
| `geist` | app/layout.tsx (GeistSans, GeistMono) |
| `lucide-react` | AppShell, páginas (acidentes, entregas, admin, relatórios, ordens, spci-extintores) |
| `xlsx` | API relatórios/generate, alterdata/import, import/* (acidentes, cipa, ordens-servico, spci), páginas ordens-de-servico, ordem-servico, spci-extintores (export) |

### 1.2 Dependências **parciais ou inconsistentes**

| Pacote | Situação |
|--------|----------|
| `react-chartjs-2` | **Não está no package.json.** Usado em DashboardEPIClient e em BarChart01. Instalado só no deploy via `vercel.json` (`npm i -E react-chartjs-2@5.2.0`). Em ambiente local, `npm install` sozinho não instala e o build pode quebrar. **Recomendação:** adicionar `react-chartjs-2` em `dependencies` do `package.json`. |

### 1.3 Dependências **não usadas** no código atual

Nenhuma dependência de produção listada no `package.json` está totalmente sem uso.  
O que não aparece em imports diretos (ex.: `date-fns`, `react-day-picker`, `react-transition-group`) é usado apenas por componentes que hoje **não** estão na árvore ativa do app (veja seção de componentes não usados).

---

## 2. Rotas e páginas

### 2.1 Páginas **em uso** (acessíveis pelo menu ou fluxo normal)

| Rota | Descrição | Menu / fluxo |
|------|-----------|----------------|
| `/` | Redirect para `/dashboard` | Entrada do site |
| `/dashboard` | Dashboard EPI (gráficos, KPIs) | Menu "Dashboard" |
| `/relatorios` | Relatórios e export XLSX | Menu "Relatórios" |
| `/estoque` | Estoque SESMT | Menu "Estoque SESMT" |
| `/acidentes` | Acidentes | Menu "Acidentes" |
| `/spci-extintores` | Extintores / SPCI | Menu "Extintores" |
| `/entregas` | Entregas de EPI | Menu "Entregas" |
| `/ordens-de-servico` | Ordens de serviço | Menu "Ordens de Serviço" |
| `/cipa` | CIPA (tela básica) | Menu "CIPA" |
| `/admin` | Admin (usuários, logs, importar Alterdata, link importar-bases) | Menu "Admin" |
| `/admin/importar-bases` | Importar outras bases (SPCI, CIPA, acidentes, OS) | Link na página Admin (root) |
| `/configuracoes` | Configurações / preferências | Menu "Configurações" |
| `/sign-in`, `/sign-up` | Auth Clerk | Fluxo de login |

### 2.2 Páginas **existentes mas fora do menu** (rotas “secundárias”)

| Rota | Descrição | Observação |
|------|-----------|------------|
| `/colaboradores` | Lista de colaboradores (API entregas/options + colaboradores/list) | Não há link no menu. Acessível digitando a URL. |
| `/colaboradores/alterdata/pro` | Alterdata “pro” (DataTablePro, API alterdata/paginated) | Também sem link no menu. |
| `/ordem-servico` | Conteúdo muito parecido com `/ordens-de-servico` | Rota duplicada; o menu usa apenas `/ordens-de-servico`. |
| `/admin/importar` | Só faz `redirect('/admin')` | Rota redundante. |
| `/pendencias` | Página mínima (“Pendências por colaborador…”) | Não está no menu; provavelmente prevista para uso futuro. |

### 2.3 Rota **duplicada** a revisar

- **`/ordem-servico`** e **`/ordens-de-servico`** fazem praticamente a mesma coisa e chamam as mesmas APIs (`/api/ordem-servico/*`). O menu usa apenas **`/ordens-de-servico`**.  
  **Sugestão:** padronizar em uma rota (ex.: só `/ordens-de-servico`) e marcar a outra como deprecated ou removê-la.

---

## 3. Componentes

### 3.1 Componentes **em uso** (na árvore ativa)

- **Layout**
  - `components/layout/AppShell.tsx` — layout principal (sidebar + conteúdo), usado pelo `(app)/layout.tsx`.
- **Admin**
  - `AdminUsersClient`, `AdminLogsClient`, `ImportarAlterdataClient` — usados em `(app)/admin/page.tsx`.
- **Configurações**
  - `ConfiguracoesPreferencias` — usada em `(app)/configuracoes/page.tsx`.
- **Dashboard**
  - `DashboardEPIClient` — usada em `(app)/dashboard/page.tsx` (dynamic import).
- **Charts e utils usados pelo dashboard atual**
  - `DoughnutChart` — usado por DashboardEPIClient.
  - `components/utils/Utils.js` — usado por DashboardEPIClient (formatThousands) e por BarChart01 (que está na árvore só via outro chart).
- **Tema**
  - `ThemeSwitcherGeist` — usado no AppShell.
- **Colaboradores Alterdata Pro**
  - `DataTablePro` — usada em `(app)/colaboradores/alterdata/pro/AlterdataClient.tsx`.

Ou seja: o que o usuário “vê” no fluxo principal (menu + admin + configurações + dashboard + colaboradores/alterdata/pro) vem desses componentes.

### 3.2 Componentes **não usados** no site atual

Nenhuma página nem o AppShell importa estes componentes. Eles ficaram de um layout/template antigo ou de telas não ligadas ao menu:

| Componente | Motivo de estar “não usado” |
|------------|------------------------------|
| `components/pages/Dashboard.tsx` | O dashboard em uso é o **DashboardEPIClient**; este Dashboard antigo (Sidebar + Header + 13 cards + Datepicker) não é importado por nenhuma rota. |
| `components/pages/Placeholder.tsx` | Não importado em nenhum arquivo. |
| `components/pages/PlaceholderStandalone.tsx` | Não importado. |
| `components/pages/KitsPage.tsx` | Não existe rota no menu (nem `/kits`). Nenhuma página importa KitsPage. |
| `components/alterdata/AlterdataFullClient.tsx` | Nenhuma página importa; a tela “Alterdata” em uso é a do fluxo colaboradores/alterdata/pro (AlterdataClient + DataTablePro). |
| `components/partials/Sidebar.jsx` | Só é importado por Dashboard.tsx e PlaceholderStandalone.tsx, que não estão em uso. O AppShell usa uma Sidebar definida dentro dele mesmo. |
| `components/partials/Header.jsx` | Idem: só usado por Dashboard e PlaceholderStandalone. |
| `components/partials/Banner.jsx` | Só usado por Dashboard.tsx. |
| `components/partials/dashboard/DashboardCard01.jsx` … `DashboardCard13.jsx` | Todos usados apenas por Dashboard.tsx. |
| `components/charts/BarChart01.jsx`, `BarChart02.jsx`, `BarChart03.jsx` | Usados só pelos DashboardCards. |
| `components/charts/LineChart01.jsx`, `LineChart02.jsx` | Idem. |
| `components/charts/RealtimeChart.jsx` | Usado só por DashboardCard05. |
| `components/ChartjsConfig.jsx` (raiz) | Usado por charts que hoje só rodam dentro do Dashboard antigo. |
| `components/charts/ChartjsConfig.jsx` | Idem. |
| `components/Datepicker.jsx` (raiz) | Só usado por Dashboard.tsx. |
| `components/DropdownFilter.jsx` (raiz) | Só usado por Dashboard.tsx. |
| `components/components/Datepicker.jsx` | Encadeado ao Dashboard antigo (calendar + popover). |
| `components/components/DateSelect.jsx` | Não importado em nenhum arquivo. |
| `components/components/DropdownEditMenu.jsx` | Usado só pelos DashboardCards. |
| `components/components/DropdownFilter.jsx` | Não usado (Dashboard usa o DropdownFilter da raiz). |
| `components/components/DropdownHelp.jsx` | Usado só pelo Header.jsx. |
| `components/components/DropdownNotifications.jsx` | Idem. |
| `components/components/DropdownProfile.jsx` | Idem. |
| `components/components/ModalSearch.jsx` | Usado só pelo Header.jsx. |
| `components/components/ThemeToggle.jsx` | Usado só pelo Header.jsx. |
| `components/components/Tooltip.jsx` | Usado só por DashboardCard05 e DashboardCard09. |
| `components/components/ThemeSwitcherGeist.tsx` | **Este está em uso** no AppShell. Os outros componentes em `components/components/` listados acima é que não estão na árvore ativa. |
| `components/components/ui/calendar.jsx` | Usado pelo Datepicker de `components/components`, que não está em uso. |
| `components/components/ui/popover.jsx` | Idem; além disso importa `@radix-ui/react-popover` e `../../lib/utils` — essas dependências **não** estão no package.json. |
| `components/partials/SidebarLinkGroup.jsx` | Usado pelo Sidebar.jsx antigo, que não está em uso. |
| `components/utils/ThemeContext.jsx` | Usado por vários charts (DoughnutChart, RealtimeChart, LineChart01/02, BarChart02/03). O **DoughnutChart** está em uso (DashboardEPIClient), então **ThemeContext está em uso** indiretamente. |
| `components/utils/Transition.jsx` | Usado por algum componente que precise deTransition; não encontrado na árvore ativa. |
| `components/utils/Info.jsx` | Não importado. |

### 3.3 Arquivos **raiz** que não fazem parte do app

- `app-index.tsx` (raiz do projeto)
- `components/app-index.tsx`
- `src/components/app-index.tsx`  
Nenhum deles é importado por `app/page.tsx` nem por layout. A página inicial só faz `redirect('/dashboard')`. Esses arquivos são **código morto** no fluxo atual.

---

## 4. APIs (app/api)

### 4.1 APIs **em uso** (chamadas por páginas ou por outras APIs em uso)

Chamadas a partir das páginas e fluxos ativos:

- **Dashboard:** `/api/dashboard/metrics`, `/api/ordem-servico/meta-real`, `/api/spci/stats`, `/api/acidentes/stats` (conforme uso em DashboardEPIClient).
- **Relatórios:** `/api/relatorios/generate` (e possivelmente entregas).
- **Estoque:** `/api/estoque/options`, `/api/estoque/items`, `/api/estoque/mov`, `/api/estoque/catalogo`, `/api/estoque/pedidos`, `/api/estoque/visao`.
- **Acidentes:** todas as rotas under `api/acidentes/` que a página de acidentes chama (list, meta-real, save, stats, taxa-frequencia, options, etc.).
- **SPCI/Extintores:** `/api/spci/list`, `/api/spci/meta-real`, `/api/spci/options`, `/api/spci/stats`, `/api/spci/update`.
- **Entregas:** `/api/entregas/*` usadas pela página de entregas (options, list, check-cpf, deliver, manual, meta, progresso, diagnostico-unidades, resumo-epis-tipo, etc.) e `/api/colaboradores/situacao-meta`.
- **Ordens de serviço:** `/api/ordem-servico/options`, `/api/ordem-servico/list`, `/api/ordem-servico/meta-real`, `/api/ordem-servico/save`.
- **Admin:** `/api/admin/users/list`, save, verify; `/api/admin/logs`; `/api/alterdata/import`, `/api/alterdata/stats`, `/api/alterdata/diagnostic`; import (acidentes, cipa, ordens-servico, spci) via admin/importar-bases.
- **Colaboradores:** `/api/colaboradores/list`, `/api/entregas/options` (página colaboradores).
- **Colaboradores Alterdata Pro:** `/api/alterdata/paginated`.
- **Configurações:** `/api/preferencias` (GET/POST).

Além disso, há uso entre APIs, por exemplo:

- `api/entregas/list` chama `api/alterdata/raw-rows` (ou similar).
- Várias rotas de import e de relatórios usam `xlsx` e lógica interna já mapeada.

Ou seja: a maior parte de `api/acidentes`, `api/admin`, `api/alterdata` (import, stats, diagnostic, raw-rows, paginated), `api/colaboradores`, `api/dashboard`, `api/entregas`, `api/estoque`, `api/import/*`, `api/ordem-servico`, `api/preferencias`, `api/relatorios`, `api/spci` está em uso.

### 4.2 APIs **pouco ou não chamadas** pelo front atual

- **`/api/debug/*`** (functions, inspect, neon-connection, test-epi-map, unidades-alterdata) — rotas de diagnóstico; normalmente não são chamadas pela UI.
- **`/api/alterdata/all`** — usada só por AlterdataFullClient, que não está em uso.
- **`/api/alterdata/raw-columns`** — idem.
- **`/api/alterdata/diag/*`, `diagnostic`** — usada por ImportarAlterdataClient (está em uso no admin).
- **`/api/kits/*`** (list, map, delete, upsert, ping) — usadas por KitsPage e possivelmente por alguma lógica de kit; KitsPage não está em nenhuma rota do menu.
- **`/api/items/options`** — usada por KitsPage.
- **`/api/pendencias/list`** — a página `/pendencias` não está no menu e hoje é só um placeholder; não há evidência de chamada a essa API.
- **`/api/etl/sync`** — não verificada chamada a partir do front.
- **`/api/epi/map`** — não verificada chamada direta a partir das páginas analisadas.
- **`/api/ordem-servico/debug`** — rota de debug.
- **`/api/spci/debug`** — idem.

Ou seja: o que está “não usado” são sobretudo rotas de **debug**, **kits** (sem tela no menu), **pendencias** e algumas rotas de **alterdata** ligadas ao AlterdataFullClient.

---

## 5. Arquivos “sujos” e configurações

- **Backups / utilitários no repositório:**  
  Existem arquivos `.bak`, `.bak_from_v7`, `route.ts.bak`, `ADD_THIS_SNIPPET.ts`, `route.with-join.example.ts`, etc. Não impactam o runtime, mas poluem o repo. Vale movê-los para pasta de docs/exemplos ou removê-los.
- **`FIX_REPORT.json`** — parece relatório de correções; pode ser útil para histórico ou ser ignorado em review de “código do site”.
- **`components/components/ui/popover.jsx`** (e possivelmente `calendar.jsx`) importam `cn` de `../../lib/utils` ou `../lib/utils`. Não existe `lib/utils` no projeto (não há `cn` exportado em `lib/`). Esses componentes só entrariam em uso se o Dashboard antigo ou o Datepicker fossem ativados; hoje isso quebraria em tempo de build/run. Ou seja: **código morto e quebrado**.
- **`@radix-ui/react-popover`** — usado em `popover.jsx`, **não** está no `package.json`. Só é relevante se alguém reativar o fluxo do Datepicker/calendar/popover.

---

## 6. Resumo de ações sugeridas

### Alta prioridade

1. **package.json:** incluir `react-chartjs-2` em `dependencies` e deixar o `vercel.json` apenas como override se necessário, para que `npm install` local seja suficiente.
2. **Rotas duplicadas:** decidir entre `/ordem-servico` e `/ordens-de-servico` (recomendado manter só `/ordens-de-servico` e tratar `/ordem-servico` como redirect ou deprecated).

### Média prioridade

3. **Menu:** se “Colaboradores” e “Alterdata pro” forem funcionalidades desejadas, adicionar itens no AppShell; caso contrário, documentar que são rotas internas/experimentais.
4. **Página `/pendencias`:** ou conectar à API e ao fluxo de negócio, ou deixar explícito que é placeholder e, se for o caso, esconder do menu.
5. **`/admin/importar`:** remover ou redirecionar de forma definitiva para `/admin` para evitar duas URLs para a mesma função.

### Limpeza (opcional)

6. **Componentes não usados:** remover ou mover para pasta `_legacy`/`_unused` (Dashboard antigo, Placeholder*, KitsPage, AlterdataFullClient, Sidebar/Header/Banner antigos, todos os DashboardCards, BarChart01/02/03, LineChart01/02, RealtimeChart, Datepicker(s), Dropdown*, ModalSearch, ThemeToggle, Tooltip, calendar, popover, etc.). Isso reduz ruído e deixa claro o que é “site atual”.
7. **app-index / src/components/app-index:** remover ou marcar como não usado.
8. **Arquivos .bak e exemplos:** tirar da raiz/app e colocar em doc ou apagá-los.
9. **Dependências:** se depois da limpeza algum pacote (ex.: `react-day-picker`, `react-transition-group`, `date-fns`) ficar só em componentes removidos, pode ser candidato a sair do `package.json` em uma etapa seguinte.

---

## 7. Visão geral “o que o site usa hoje”

- **Framework:** Next.js 14 (App Router), React 18.
- **Auth:** Clerk (middleware, layout, páginas de sign-in/sign-up e APIs que checam `auth()`).
- **DB/ORM:** Prisma + PostgreSQL (Neon).
- **UI:**  
  - Layout: **AppShell** (sidebar própria + UserButton + ThemeSwitcherGeist).  
  - Páginas: cada rota do menu renderiza ou uma página específica (acidentes, entregas, estoque, etc.) ou um client component (DashboardEPIClient, admin components, ConfiguracoesPreferencias, AlterdataClient em colaboradores/alterdata/pro).
- **Charts:** Chart.js (+ react-chartjs-2 onde há gráficos tipo Line no DashboardEPIClient); DoughnutChart usa ThemeContext e chartjs-adapter-moment na árvore ativa.
- **Tema:** next-themes + geist (fontes); ThemeSwitcherGeist no header.
- **Export/import:** xlsx em várias APIs e em algumas páginas (relatórios, ordens, spci, importação de bases).

O resto do repositório é suporte (APIs, lib, Prisma, SQL), templates de página, auth e assets — em grande parte em uso. O que realmente “não é usado no site” são os componentes e rotas listados nas seções 2.2, 3.2 e 4.2 e os arquivos de exemplo/backup da seção 5.

---

## 8. Remoção realizada (limpeza)

**Arquivos removidos em jan/2025** — tudo com zero referências no código em uso:

- **Raiz:** `app-index.tsx`
- **components:** `app-index.tsx`, `ChartjsConfig.jsx`, `Datepicker.jsx`, `DropdownFilter.jsx`
- **components/pages:** `Dashboard.tsx`, `Placeholder.tsx`, `PlaceholderStandalone.tsx`, `KitsPage.tsx`
- **components/alterdata:** `AlterdataFullClient.tsx`
- **components/partials:** `Sidebar.jsx`, `Header.jsx`, `Banner.jsx`, `SidebarLinkGroup.jsx`
- **components/partials/dashboard:** `DashboardCard01.jsx` … `DashboardCard13.jsx`
- **components/components:** `ModalSearch.jsx`, `DropdownNotifications.jsx`, `DropdownHelp.jsx`, `DropdownProfile.jsx`, `ThemeToggle.jsx`, `DropdownEditMenu.jsx`, `Tooltip.jsx`, `DateSelect.jsx`, `DropdownFilter.jsx`, `Datepicker.jsx`
- **components/components/ui:** `calendar.jsx`, `popover.jsx`
- **components/charts:** `BarChart01.jsx`, `BarChart02.jsx`, `BarChart03.jsx`, `LineChart01.jsx`, `LineChart02.jsx`, `RealtimeChart.jsx`
- **components/utils:** `Transition.jsx`, `Info.jsx`
- **src/components:** `app-index.tsx`
- **Backups/exemplos:** `app/page.tsx.bak`, `app/api/alterdata/all/route.ts.bak`, `app/api/entregas/list/route.ts.bak_from_v7`, `app/api/alterdata/raw-rows/route.with-join.example.ts`, `app/api/alterdata/import/ADD_THIS_SNIPPET.ts`

**Mantidos (em uso):** `ThemeSwitcherGeist`, `Utils.js`, `ThemeContext.jsx`, `charts/ChartjsConfig.jsx`, `DoughnutChart.jsx`, `DashboardEPIClient`, `AppShell`, componentes de admin/config e demais páginas e APIs.
