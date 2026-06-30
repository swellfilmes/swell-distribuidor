# Auditoria — Pilar 05 · UX & Design System

**Escopo:** `app/`, `components/`, `tailwind.config.ts`, `app/globals.css`.
**Tema de referência:** dark Linear/Stripe/Vercel — `#08131F` app, `#0F1D2D` surface, `#FF7A00` primary, Inter + DM Serif Display.
**Usuário-alvo:** Swell Filmes (produtora premium de Salvador), operador não-técnico.

---

## Nota: 5.5 / 10

Há uma base de design tokens decente (Tailwind config, focus ring global, scrollbar discreta, tipografia serif/sans) e o onboarding wizard (`OnboardingWizard.tsx` + steps) está acima da média — premium, claro, consciente do usuário. Mas o produto **falha em coisas básicas pro perfil "premium / não-técnico"**: o app é inutilizável em mobile (sidebar `hidden md:flex` sem alternativa), há um bug de tema claro vazando no meio do app dark (gradient branco no `/app/onboarding`, badges com `bg-blue-100`, fundo `bg-cream/50` em form dark), nenhuma confirmação destrutiva é desenhada (`window.confirm()` browser-padrão pra rejeitar / desativar / remover membro), os botões críticos "Aprovar / Rejeitar" no drawer são azul-branco e rosa-branco (não tokenizados, não premium), e empty states + skeletons quase não existem. Falta um **kit de componentes mínimo** (Button, Input, Modal, Card) — cada tela reinventa as classes do zero, gerando inconsistência visível.

---

## Pontos fortes

1. **Tokens semânticos bem desenhados** em `tailwind.config.ts`: `app / surface / surface-2 / fg / fg-muted / bd / primary / success / error`, com aliases legacy explicitamente comentados. Raio, transição default (180ms) e fontes vinculadas via `next/font`. Setup de tokens nota alta.
2. **Focus ring global no laranja Swell** em `app/globals.css:62-66` via `:focus-visible` — boa decisão de a11y de baseline.
3. **Onboarding com identidade premium**: `OnboardingProgress.tsx` (steps com check animado), `StepBoasVindas.tsx` (numerais mono `01/02/03` + serif), `StepPronto.tsx` (success state com ícone vetorial) — esse fluxo está coerente com "premium cinematográfico".
4. **TopBar Linear-like**: search com placeholder, ícone, `⌘K`, blur backdrop e `sticky top-0` (`components/TopBar.tsx:11-43`). Cosmeticamente nota alta — apesar do search ser dummy (não filtra nada).
5. **Sidebar com ícones SVG inline, estado ativo bem desenhado** (`components/Sidebar.tsx:45-69`), badge "online" verde no rodapé.
6. **Cards de mídia / vídeo no drawer** mostram thumbnail e player nativo dentro de `<details>` colapsável (`PostDetailDrawer.tsx:91-122`) — interação leve.
7. **Optimistic UI bem feito** na `PostsTable` (lapis de status, data e copy reverte com erro e auto-refresca a cada 30s — `PostsTable.tsx:149-202`). Boa UX percebida.
8. **Estados na Uploader são claros**: fila → subindo → enfileirado → processando → concluido/erro com cards coloridos (`Uploader.tsx:546-657`).

---

## Problemas críticos

### 1. App NÃO funciona em mobile — sidebar some sem fallback
- `components/Sidebar.tsx:37` → `hidden ... md:flex`. Abaixo de 768px, **sidebar somem e não há botão hamburger nem drawer alternativo**. O TopBar (`components/TopBar.tsx`) também esconde a busca `sm:block`. Em 360px o usuário não consegue navegar entre Posts/Upload/Configurações — só via URL direta. Isso por si só zera a nota de "responsivo".

### 2. Tema claro vazando no onboarding (regressão visual gritante)
- `app/app/onboarding/page.tsx:55` → `bg-gradient-to-b from-white to-amber-50/40`. O resto do app é dark `#08131F`. Quem vem do dashboard escuro pro onboarding leva um flash branco. Estraga totalmente a sensação "premium cinematográfico".
- Mesmo bug: `components/PostDetailDrawer.tsx:416,423` → `bg-cream/50` (alias legacy `cream = #0F1D2D` é dark, mas com `/50` numa caixa filha vira amaciado e contrasta mal com o restante).
- `components/PostDetailDrawer.tsx:67` → hover do botão fechar: `hover:text-app`. Como `text-app = #08131F` (cor do BG), o ícone literalmente **vira invisível no hover**. Bug funcional, não cosmético.

### 3. Status / Rede badges são paleta clara (não-dark)
- `components/StatusBadge.tsx:7-15,37-40` → `bg-blue-100 text-blue-800`, `bg-violet-100`, `bg-orange-100`, `bg-pink-50 text-pink-700`, `bg-slate-100`. Esses blocos de cor pastel **rasgam o dark** do dashboard. Os badges deveriam ser dark-friendly (`bg-color/15 text-color ring-color/30`) como já é o `Aguardando` (`bg-primary/12 text-fg`).
- Pior: mistura tokens com cores hard-coded (`ring-amber-200`, `ring-rose-200`) sem coerência.

### 4. Confirmações destrutivas são `window.confirm()` nativo
- `components/ToggleAtivo.tsx:21`, `MembrosManager.tsx:66,76`, `ConvitesOnboardingPanel.tsx:85` usam `confirm()` do browser. Isso é o oposto de "premium": dá um diálogo cinza padrão do macOS/Chrome. Para uma produtora cinematográfica aprovando/desativando empresas e removendo membros, **precisa de Modal estilizado** (com trap focus, ESC, dark coerente).
- O `Uploader.tsx:269` também usa `alert(...)` pra arquivo grande — mesmo problema.

### 5. Botões de ação "Aprovar / Rejeitar" no drawer estão fora do design system
- `components/PostDetailDrawer.tsx:258-279` → `bg-blue-600`, `bg-rose-600`, `text-white`. Aprovar/rejeitar é a **ação mais importante de todo o produto** (porta de aprovação humana) e está com cores não tokenizadas, sem identidade Swell. Deveria ser `bg-primary` (aprovar) e variante `bg-error` (rejeitar) — ou um par bem desenhado.
- O `Link "text-blue-700 underline"` em `PostDetailDrawer.tsx:223,243` é igual — link azul claro num app dark.

### 6. AI badge inverte tema (fundo claro)
- `PostDetailDrawer.tsx:50` → `bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100`. Stand-out, mas com fundo cor de rosa-claro num app dark. Quebrado.

### 7. Sem componentes reutilizáveis — cada tela reinventa Button/Input/Card
- `Button`: cada arquivo escreve `rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-app hover:opacity-90 disabled:opacity-40` à mão. 20+ ocorrências espalhadas. Variações entre arquivos: `rounded-md` vs `rounded-lg`, `text-app` vs `text-white`, `disabled:opacity-40` vs `disabled:opacity-60`.
- `Input`: `EmpresaForm.tsx:336` (campo), `ConvitesOnboardingPanel.tsx:114`, `MembrosManager.tsx:97`, `ZernioEditor.tsx:201` — todos com classes manuais ligeiramente diferentes (`border-bd/15` vs `border-bd/40`, `focus:ring-primary/20` vs `focus:ring-primary/30` vs `focus:border-bd`).
- `Card / Section`: três variações coexistem (`Bloco` no `EmpresaForm`, `Section` no `PostDetailDrawer`, `CartaoAcao` em duas versões diferentes — `app/page.tsx:91` e `StepPronto.tsx:57`).
- Resultado: visual quase consistente, mas com variações suficientes pra parecer "feito por dois designers".

### 8. PostDetailDrawer tem várias falhas de a11y / UX de drawer
- `components/PostDetailDrawer.tsx:32-37` → overlay é `bg-primary/40 backdrop-blur-sm` (laranja). Convenção é overlay neutro (`bg-black/60`). Ficou tudo laranja.
- Drawer **não tem focus trap** — Tab escapa pra elementos atrás. Tem ESC ✓ e click-outside ✓, mas falta trap.
- Drawer não tem `role="dialog" aria-modal="true" aria-labelledby`.
- Quando abre, o body atrás **não trava scroll** (não há `overflow-hidden` no body).

### 9. Empty states fracos
- `PostsTable.tsx:399-402` → "Nenhum post encontrado com esses filtros." sem CTA pra limpar filtro nem ilustração.
- `app/page.tsx:38-41` → "Você ainda não tem empresa vinculada — peça pro admin te adicionar ou use um link de convite." sem botão / link.
- `MembrosManager.tsx:131,159` → "Ninguém ainda." / "Nenhum." — secos demais.
- `app/app/admin/page.tsx:48-50` → o único bem feito (dashed border + tom de voz).

### 10. Skeleton loaders praticamente inexistentes
- O único "loader" é `Carregando tabela...` (`app/app/posts/page.tsx:140`) e `Preparando seu cadastro no Zernio...` (`StepZernio.tsx:180`). Para um produto que faz queries Notion + Zernio + R2 (latência alta), deveriam ter skeleton rows na tabela, skeleton de cards na home, skeleton no detail drawer.
- Auto-refresh a cada 30s na tabela acontece silenciosamente — não há indicador de "atualizando agora".

### 11. Contraste / legibilidade fraca em vários lugares
- `text-fg-muted/55`, `text-fg-muted/50`, `text-fg-muted/40` aparecem em 40+ lugares. `#94A3B8` (`fg-muted`) já está no limite de WCAG AA contra `#08131F`; aplicar 0.4 de opacity zera a leitura.
- Exemplos: rodapé da Sidebar "v2.7" (`text-fg-muted/70`), "Limpar filtros" (`text-fg-muted/60`), helper de hashtags (`text-fg-muted/55`), label das colunas (`text-fg-muted/60`), label `Mês`/`Status` de filtro (`text-fg-muted/50` — quase ilegível).
- `text-fg-muted/45` em `ZernioEditor.tsx:149`. Provavelmente reprovaria em AA.

### 12. Hex hard-coded e gradientes inconsistentes
- `components/onboarding/StepZernio.tsx:28-49` — 8 hex literais (#E1306C, #FF0000, #111827, etc) pra cor de marca de cada rede. Aceitável (cores oficiais das redes), mas sem comentário e sem viver num arquivo de constantes.
- `app/api/notion/oauth/callback/route.ts:33` — HTML inline com `color:#b00020`.

### 13. Pseudo-tokens inexistentes no Tailwind (`bg-primary/8`, `bg-primary/12`)
- `OnboardingPendingBanner.tsx:27`, `app/page.tsx:45`, `posts/page.tsx:56,85`, `Uploader.tsx:672`, `ConviteOnboardingUI.tsx:52`, `StatusBadge.tsx:7` — Tailwind por padrão só aceita opacidades em incrementos de 5 (5, 10, 15, 20). `bg-primary/8` e `/12` podem ser silenciosamente ignorados (depende de JIT). Padronizar pra `/10` e `/15`.

### 14. Componentes monolíticos
- `PostsTable.tsx` (552 linhas) e `Uploader.tsx` (678 linhas) misturam markup + state + handlers + sub-componentes. Difícil reusar, testar, ou aplicar mudança visual consistente.

### 15. Nome do produto / marca
- "Swell Mermaid" aparece em layout/sidebar — mas nenhum lugar nas páginas de erro, signin, signup, ou empty states usa "Swell Filmes" pra reforçar identidade. O `app/page.tsx:13` chama "Swell Distribuidor" (terceiro nome). Falta consistência da marca.

### 16. Inputs em forms com fundo claro inconsistente
- `EmpresaForm.tsx:336` → `bg-surface` (dark). `ConviteOnboardingUI.tsx:114` → `bg-surface-2/60`. `MembrosManager.tsx:97` → `bg-surface`. `ConvitesOnboardingPanel.tsx:114` → `bg-surface-2/60`. Pequenas variações em todo lugar.

---

## Recomendações priorizadas

### P0 — bloqueia o pilar "premium"
1. **Criar componentes-base** em `components/ui/`: `Button` (variants: primary, secondary, ghost, danger), `Input`, `Textarea`, `Select`, `Card`, `Section`, `Modal`, `Drawer`, `ConfirmDialog`, `Badge`, `Skeleton`. Migrar tudo. Vai colapsar ~2000 linhas de classes repetidas.
2. **Tornar o app responsivo**: substituir Sidebar `hidden md:flex` por drawer mobile (botão hamburger na TopBar abrindo um `<aside>` slide-in). Sem isso, mobile = inutilizável.
3. **Recolorir todos os badges (Status + Rede + AI) pro tema dark**, usando pares `bg-<token>/15 text-<token> ring-<token>/30`. Acabar com `bg-blue-100`, `bg-pink-50`, `bg-fuchsia-50`, etc.
4. **Substituir `window.confirm()` e `alert()`** por um `ConfirmDialog` com identidade Swell — em `ToggleAtivo`, `MembrosManager`, `ConvitesOnboardingPanel`, `Uploader` (5 ocorrências).
5. **Consertar bugs visuais óbvios**:
   - `app/app/onboarding/page.tsx:55` — trocar `bg-gradient-to-b from-white to-amber-50/40` por algo dark (`from-app to-surface` ou só `bg-app`).
   - `PostDetailDrawer.tsx:67` — `hover:text-app` vira invisível; usar `hover:text-fg`.
   - `PostDetailDrawer.tsx:416,423` — substituir `bg-cream/50` por `bg-surface-2`.
   - `PostDetailDrawer.tsx:34` — overlay `bg-primary/40` → `bg-app/70` ou `bg-black/60`.
6. **Botões "Aprovar / Rejeitar" do drawer** (`PostDetailDrawer.tsx:258-279`) precisam virar os botões mais bem desenhados do app — não `bg-blue-600 / bg-rose-600` brancos.

### P1 — qualidade percebida
7. **Drawer com a11y completo**: focus trap + `role="dialog" aria-modal="true" aria-labelledby="..."` + lock body scroll.
8. **Skeletons** na PostsTable (3-5 linhas), no dashboard cards, no drawer ao abrir.
9. **Empty states com CTA visual** — ilustração SVG simples + texto + botão "Subir primeiro vídeo" / "Limpar filtros" / "Convidar primeiro membro".
10. **Indicador de "atualizando agora"** quando o auto-refresh dispara (spinner no Sync Zernio + Atualizado X atrás).
11. **Padronizar opacidades válidas no Tailwind**: trocar `/8`, `/12`, `/45`, `/55`, `/65` por `/10`, `/15` (badges/banners), `/50`, `/60`, `/70` (texto). Inclui customizar `tailwind.config` se quiser permitir os intermediários.
12. **Mensagem "Buscar posts, clientes, redes…" no TopBar não busca nada** — ou tira, ou implementa, ou rotula como "(em breve)".

### P2 — polimento
13. **Quebrar `PostsTable.tsx` e `Uploader.tsx`** em sub-arquivos (Filtros, ColunaSort, Toolbar, etc).
14. **Constantes de cor das redes** (Instagram, YouTube, TikTok, LinkedIn) num arquivo `lib-web/redeBrand.ts` com hex + gradient — não dispersar nos componentes.
15. **Marca consistente**: "Swell Mermaid" em layout, "Swell Filmes" como produtora cliente, "Swell Distribuidor" no signin — escolher um nome de produto e usar em todos os títulos / metadata.
16. **Validar contraste WCAG AA** com axe / contraste — em particular tudo que usa `text-fg-muted/40-60`.
17. **Motion**: o `transitionDuration` default está em 180ms (bom), mas micro-interações úteis (botão approve → toast de sucesso animado, badge mudando de Aguardando → Aprovado com transition no badge) estão ausentes.
18. **Ícones de status (✓ ✕ ↺) no drawer** — substituir por SVGs vetoriais consistentes com o resto.

---

## Achados específicos por arquivo

| Path | Achado |
|---|---|
| `app/app/onboarding/page.tsx:55` | Gradient branco-âmbar num app dark |
| `components/Sidebar.tsx:37` | `hidden md:flex` sem alternativa mobile |
| `components/PostDetailDrawer.tsx:34,67,258-279,416,423` | Overlay laranja, hover invisível, botões fora do DS, bg cream |
| `components/StatusBadge.tsx:7-15,35-40` | Paleta clara num app dark |
| `components/ToggleAtivo.tsx:20`, `MembrosManager.tsx:66,76`, `ConvitesOnboardingPanel.tsx:85`, `Uploader.tsx:269` | `confirm()` / `alert()` nativos |
| `components/PostsTable.tsx`, `components/Uploader.tsx` | 552 / 678 linhas, monolíticos |
| `app/page.tsx:13`, `app/layout.tsx:20` | "Swell Distribuidor" vs "Swell Mermaid" |
| `tailwind.config.ts:46-52` | Aliases legacy (`cream`, `ink`, `accent`) ainda usados no PostDetailDrawer — sinal de migração inacabada |
