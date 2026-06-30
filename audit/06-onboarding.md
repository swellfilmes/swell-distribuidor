# Auditoria — Pilar 06: ONBOARDING & FLUXO DO USUÁRIO

**Data:** 2026-06-30
**Escopo:** Swell Mermaid (SaaS multi-tenant em produção, iniciando rodada de testes humanos)
**Auditor:** Claude (Opus 4.7)

---

## Nota: 7,0 / 10

Onboarding é o pilar mais polido do projeto pra um SaaS pré-rodada. O caminho feliz é genuinamente curto (4 cliques úteis), os steps têm copy clara em PT-BR pra leigo (estimativa de tempo, "1 clique", "~1 min por rede"), e a recuperação de estado é a melhor parte: se o testador fechar a aba no meio, ele consegue retomar do dashboard via banner persistente. **Os buracos são em duas categorias:** (a) ausências básicas de SaaS sério (welcome email, termos/LGPD, tour, empty state da primeira tela de Posts), e (b) bugs/fricções específicas que já provocaram patches recentes — banner stuck, slug imutável, fricção na 1ª passagem pelo Notion OAuth.

---

## Justificativa

### Caminho do convite até "1º post agendado" — passos mínimos

A partir do clique no link de convite até a UI conseguir agendar o 1º post, o testador toca em:

1. **Link `/convite/[token]`** (`app/convite/[token]/page.tsx`) — landing com "Criar conta" / "Já tenho conta".
2. **Sign-up Clerk** (`app/sign-up/[[...sign-up]]/page.tsx`) — email + senha + verificação. Clerk com `redirect_url` volta pra `/convite/<token>`.
3. **Form "Nome da empresa + slug"** (`ConviteOnboardingUI.tsx`) — 2 campos (slug auto-gerado). Submete em `POST /api/convites-onboarding/[token]/consumir` → cria empresa pendente + membership owner + cookie `EMPRESA_COOKIE` → redirect pra `/app/onboarding?empresa=ID`.
4. **Wizard** (`OnboardingWizard.tsx`) — pula `boas-vindas` se algum step já foi feito; abre direto em `notion` se nada feito.
5. **Notion OAuth** (`StepNotion.tsx` → `/api/notion/oauth/start` → Notion autorize → `/api/notion/oauth/callback`) — cria a DB de Distribuição automaticamente via `criarDistribuicaoDb()`. Volta pro wizard com `?notion=conectado&workspace=X`. **1 clique no botão + 1 clique no Notion = pronto.** Esse é o ponto mais bonito do onboarding.
6. **Zernio Profile** (`StepZernio.tsx` → `POST /api/empresas/[id]/zernio-profile`) — cria Profile compartilhado da Swell automaticamente, gera 4 authUrls (IG/YT/TT/LI), mostra 4 cards. Testador clica nas redes que quiser. Polling a cada 3s por 30s pra detectar conexão. **Mínimo aceito: 1 rede.**
7. **`StepPronto.tsx`** — 3 CTAs: Subir mídia / Ver posts / Configurações.
8. **`/app/upload`** — Uploader (não estava no escopo desse audit, mas é o destino primário pro 1º post).

**Total realista: ~5–8 minutos com tudo dando certo**, alinhado com a promessa "5-10 minutos" do `StepBoasVindas.tsx:21`. Excelente.

### Mensagens — claras pra não-técnico?

Sim, em geral. Exemplos:

- `StepNotion.tsx:46-53` explica passo a passo o popup do Notion ("escolhe uma página vazia (cria antes: 'Distribuição Swell'...)"). Bom — esse é o passo mais opaco pra leigo e tem instrução escrita.
- `StepZernio.tsx:153-156` "Vai abrir a tela oficial da rede pra você autorizar — depois volta sozinho pra cá." Sem jargão.
- `ConviteOnboardingUI.tsx:131-133` "Só letras minúsculas, números e hífens. Não pode mudar depois." — **isso é um problema.** Slug imutável sem aviso forte, sem possibilidade de mudar depois. Se o testador digita errado, vive com isso. Falta `pattern` validation visual antes do submit.
- `OnboardingPendingBanner.tsx:30-34` "{empresa} ainda precisa conectar Notion e Zernio pra publicar." — direto, mas usa "Zernio" (nome técnico) em vez de "suas redes sociais". Leigo não sabe o que é Zernio.

### Recuperação de erro / OAuth

- **Notion OAuth callback** (`app/api/notion/oauth/callback/route.ts:26-38, 51-73`) — tem `htmlErro()` que renderiza página de erro inline com link "Voltar pro wizard de onboarding". Cobre: state expirado, state mismatch (CSRF), code/state faltando, erro do Notion, troca de token falhada, criação de DB falhada. **Sólido**. Ponto fraco: a página de erro é HTML cru com estilo inline (`#b00020`) — destoa do resto do app (que está em dark theme tokens).
- **Zernio Profile** (`StepZernio.tsx`) — `erro` state visível (linha 173-177), botão "Atualizar status" pra forçar resync (linha 249-255). Cada card tem fallback `link?.erro ?? 'Link não gerado.'` (linha 227-229). Bom.
- **Convite inválido / já consumido** (`app/convite/[token]/page.tsx:55-75`) — bloco vermelho com cópia distinta pra "ja-consumido" vs. "inválido" + link pra home. Bom.

### Estado "ainda falta conectar X" — visível?

Sim, em 3 lugares (com bugs históricos):

1. **Banner no layout** `OnboardingPendingBanner.tsx` montado em `app/app/layout.tsx:64-71` aparece em TODA página `/app/*`. **Há commit recente `cc9577d fix(banner): force-dynamic no layout pra refletir estado novo`** confirmando que o banner ficava stuck antes do `export const dynamic = 'force-dynamic'` (`app/app/layout.tsx:13`) — Next 16 cacheava o layout. Resolvido.
2. **Card no dashboard** `app/app/page.tsx:44-59` "Onboarding incompleto" com link pra retomar. **Commit `7d5b8c9 fix(dashboard): usa temZernioConectado pra aceitar empresa-testador`** confirma que checava `zernioApiKey` literal em vez de Profile compartilhado — empresa-testador nunca ficava "pronto". Resolvido.
3. **Página de Posts** (`app/app/posts/page.tsx:83-99`) — guard explícito "Notion ainda não conectado" com CTA pro wizard. Bom.

Banners somem corretamente após conectar (sincronização via `router.refresh()` em `StepZernio.tsx:93`).

### Instrução de como conectar Notion

`StepNotion.tsx:46-53` lista 4 passos. **Não explica o que é "compartilhar uma página"** nem mostra screenshot/gif. Pra um leigo que nunca usou Notion, a sugestão "cria antes uma página chamada 'Distribuição Swell'" é melhor do que nada, mas o teste real é o popup do Notion — ele precisa saber escolher "Select pages" e clicar numa página existente. Sem screenshot, sem video walkthrough, sem link pra doc. **Pra produtoras audiovisuais (público alvo) que podem nem ter Notion, isso é fricção real.**

Existe um único hint em `StepNotion.tsx:64-74`: "Não tem conta Notion? Cria grátis em notion.so antes de continuar." — mas é um onboarding rude (sai do fluxo pra outro app).

### Instrução de como conectar redes via Zernio

`StepZernio.tsx:153-156` é a única explicação geral; `<details>` em 238-246 explica "Profile". Cada card só tem um botão "Conectar →". **Não há instrução** do tipo "Antes de clicar, garanta que está logado na conta certa do IG no navegador". Pro caso comum de produtora que gerencia múltiplas contas IG, esse é um furo previsível: testador clica → autoriza com a conta pessoal → IG do cliente não conectou.

### Dashboard vazio (1º acesso) tem CTA óbvio?

Quando o setup está completo mas zero posts foram criados:

- **Dashboard** (`app/app/page.tsx:62-86`) mostra 3 cards: "Subir mídia", "Tabela de posts", "Configurações". **Bom** — onboarding limpo pra "agora o que faço".
- **Posts** (`app/app/posts/page.tsx:140-148` + `PostsTable.tsx:398-404`) — empty state é só `Nenhum post encontrado com esses filtros.` em texto cinza. **Sem CTA pra subir.** Pior: a mensagem assume que tem filtro aplicado, mas no primeiro acesso não há filtro nenhum. Fica enganador.

### Termos / privacidade / LGPD?

**Inexistente.** Busca por `LGPD|privacidade|termos` em `app/`, `components/`, `lib-web/` → zero matches relevantes. Não há checkbox de termos no sign-up Clerk, não há rodapé com links, não há aviso de tratamento de dados. Pra um SaaS B2B em PT-BR que vai armazenar conteúdo de cliente, isso é débito legal real, não cosmético.

### Email de boas-vindas?

**Inexistente.** Busca por `resend|sendgrid|mailgun|nodemailer|enviarEmail` → zero matches. O único email transacional é o de verificação do Clerk. Não há email "bem-vindo + próximos passos + como pedir ajuda". Em SaaS, isso é o pior padrão pra retenção D1.

### Onboarding pode ser pulado e retomado?

Implícito sim, explícito não. Não existe botão "Pular" em `OnboardingWizard.tsx` — busca por `Pular|Skip|Mais tarde` retorna zero matches nos arquivos do wizard. Mas o testador pode navegar pra `/app` ou `/app/upload` manualmente e o banner aparece em todas as páginas com link de retomar. **Funciona, mas não é explícito.**

### Tutorial / tour?

**Inexistente.** Nenhum tour interativo (Driver.js / Shepherd / etc.), nenhum tooltip "primeiro acesso", nenhum vídeo de boas-vindas. O `StepPronto.tsx` é o mais perto disso (3 CTAs explicados), mas é uma única tela estática.

### Erros vistos em produção (git log)

Patches recentes confirmam bugs em onboarding que afetaram testers:

- `cc9577d fix(banner): force-dynamic no layout pra refletir estado novo` — banner "conectar Zernio" ficava stuck após conectar.
- `ba12677 fix(onboarding): banner some quando ≥1 rede conectada (refresh layout)` — banner não sumia até refresh manual.
- `7d5b8c9 fix(dashboard): usa temZernioConectado pra aceitar empresa-testador` — testador nunca ficava "setup completo".
- `141f4ab fix(configuracoes): onAvancar opcional pra Server Component não passar fn` — quebrava `/configuracoes` quando o testador ia adicionar mais redes depois.
- `02b217a fix(zernio-profile): usa Zernio compartilhado, não zernioDo(tenant)` — fluxo Profile quebrava.
- `06a4e66 fix(notion-oauth): qualquer membro da empresa pode conectar, não só admin` — testador não-admin não conseguia conectar Notion. **Esse é grave.**

Cluster claro: o caminho do testador (não-admin) tinha 4+ bugs que só apareceram quando alguém real tentou usar.

---

## Pontos Fortes

- **Caminho-feliz mínimo:** `/convite/<token>` → sign-up → 2 campos → wizard auto-detecta step → Notion OAuth (1 clique) → Zernio (1 clique por rede) → pronto. **4–5 cliques úteis totais.**
- **OAuth do Notion automatiza a parte chata:** cria DB sozinho via `criarDistribuicaoDb()` (`app/api/notion/oauth/callback/route.ts:138`) — testador não precisa criar database, configurar schema, copiar ID. **Esse é o ouro do projeto.**
- **Recuperação de estado em 3 camadas redundantes:** banner persistente (`OnboardingPendingBanner.tsx`), card no dashboard (`app/app/page.tsx:44`), guard explícito na página de Posts (`app/app/posts/page.tsx:83`). Testador não consegue "se perder".
- **Wizard inteligente:** `OnboardingWizard.tsx:31-35` calcula step inicial pelo estado real do banco. Se o testador volta depois de fechar a aba, abre direto no step que falta.
- **Copy em PT-BR pra leigo:** sem jargão técnico em StepBoasVindas, sem "OAuth flow" ou "API key" nas instruções visíveis. Estimativas de tempo realistas.
- **Polling pós-OAuth do Zernio** (`StepZernio.tsx:130-144`): 10 ticks de 3s pra detectar a conta aparecer. Compensa latência da Zernio API.
- **Segurança do OAuth:** state CSRF via cookie httpOnly + nonce (`app/api/notion/oauth/start/route.ts:47-58`) + revalida membership no callback (`callback/route.ts:81-87`). Bem feito.
- **Cookie de empresa-ativa** setado no `consumir` (`app/api/convites-onboarding/[token]/consumir/route.ts:50-57`) — a próxima navegação já mostra a empresa correta, sem fricção de seletor.

---

## Problemas Críticos

1. **Sem termos/privacidade/LGPD.** Zero menções no código. Sign-up Clerk não tem checkbox de termos. Pra SaaS B2B em PT-BR que armazena vídeo de cliente + manipula contas sociais, é débito legal direto. **Antes da rodada de testes humanos, no mínimo um checkbox "Li e aceito os termos" + uma página `/termos` e `/privacidade` estática.** Caminho: criar `app/termos/page.tsx` e `app/privacidade/page.tsx` + customizar Clerk SignUp com `appearance` ou link no rodapé.

2. **Sem email de boas-vindas / sem email transacional próprio.** Único email é verificação Clerk. Testador faz signup, recebe Clerk email, depois silêncio. Sem "bem-vindo, próximos passos, contato pra ajuda". Caminho: integrar Resend (mais barato/simples) num webhook do Clerk pós-signup OU dispatch no `POST /api/convites-onboarding/[token]/consumir` (`app/api/convites-onboarding/[token]/consumir/route.ts`).

3. **Empty state da página de Posts é cego.** `PostsTable.tsx:401` mostra "Nenhum post encontrado com esses filtros." num tester que acabou de terminar onboarding e nunca subiu nada. **Sem CTA pra `/app/upload`**, sem ilustração, sem "comece subindo sua primeira mídia". Caminho: detectar `posts.length === 0 && !temFiltros` em `app/app/posts/page.tsx` e mostrar empty state dedicado com botão.

4. **Slug imutável sem aviso forte.** `ConviteOnboardingUI.tsx:115-134` deixa editar com `pattern="[a-z0-9-]+"` mas só avisa em texto cinza pequeno "Não pode mudar depois." Se o testador digita "becogelato-teste" e depois quer "becogelato", precisa recriar empresa. **Considerar:** (a) permitir mudar slug em `/configuracoes` (com check de unicidade), ou (b) confirmação modal antes de submeter "Slug `<slug>` não pode ser alterado depois. Confirma?".

5. **Instrução Notion sem screenshot/gif.** `StepNotion.tsx:46-53` lista 4 passos em texto. Produtora que nunca usou Notion vai ficar perdida no popup "Select pages" do Notion. **Caminho:** adicionar 1 GIF curto (ou screenshot anotado) inline no step. Custo baixo, ganho alto.

6. **Instrução Zernio não alerta "esteja logado na conta certa".** `StepZernio.tsx` não menciona que o OAuth do IG/YT/TT vai usar a sessão atual do navegador. Pra produtora que gerencia múltiplas contas IG (caso comum no público alvo), esse é um furo previsível que leva a "conectei a conta errada". **Caminho:** adicionar warning visível em cada card "Antes de clicar, confirme que está logado no <rede> com a conta que quer conectar (abra outra aba pra verificar)."

7. **Página de erro do Notion OAuth quebra o tema.** `app/api/notion/oauth/callback/route.ts:31-37` renderiza HTML cru com `style="color:#b00020"` — destoa do dark theme. Se o testador acerta um erro (cookie expirou, mismatch), cai numa página que parece "outro site". Caminho: trocar `htmlErro()` por `redirect()` pro wizard com `?notion_erro=...` e renderizar o erro lá com os tokens do design.

8. **"Zernio" é exposto no banner pro leigo.** `OnboardingPendingBanner.tsx:32` mostra "ainda precisa conectar **Zernio**" — nome técnico que testador não entende. **Caminho:** trocar pra "ainda precisa conectar **suas redes sociais**".

9. **Sem tour / sem tooltips no 1º acesso.** Onboarding termina em `StepPronto.tsx` que tem 3 CTAs. A partir daí, o testador chega no Uploader, Posts, Configurações sem nenhuma orientação contextual. **Caminho mínimo:** primeira renderização do Uploader/Posts mostra dismissable hint card explicando o fluxo de aprovação no Notion (pergunta de leigo: "por que tenho que aprovar no Notion e não aqui?").

10. **Convite OAuth fluxo: se Clerk redirect_url não preserva, testador fica travado.** `ConviteOnboardingUI.tsx:44-45` usa `?redirect_url=...` mas Clerk em `app/layout.tsx:33-34` define `signUpFallbackRedirectUrl="/app"`. Se o link de convite expira/falha entre signup e callback, o testador vai parar em `/app` SEM ter consumido o convite — empresa não é criada e ele vê "Você ainda não tem empresa vinculada — peça pro admin..." (`app/app/page.tsx:40`). **Caminho:** detectar em `/app` se o user tem cookie/query do convite pendente e re-redirecionar.

11. **Falta indicador de "qual rede foi conectada"** quando há múltiplas tentativas. `StepZernio.tsx:202-217` mostra `@<username>` se Zernio devolver `username`, senão "conta". Pro caso comum de Zernio devolver displayName ambíguo, o testador não vê claramente "ah, conectei @becogelato_oficial" vs. "@joaosilva_pessoal". Caminho: forçar fallback com `accountId` truncado + permitir desconectar/reconectar inline.

---

## Recomendações Priorizadas

### P0 — Antes da rodada de testes humanos

1. **Adicionar termos/privacidade básicos** (debito legal). Páginas estáticas + checkbox no sign-up.
2. **Empty state de Posts com CTA.** `app/app/posts/page.tsx` + `PostsTable.tsx`. 30 min de trabalho, ganho enorme pro tester chegar no upload.
3. **Trocar "Zernio" por "suas redes sociais" no banner e dashboard.** `OnboardingPendingBanner.tsx:32`, `app/app/page.tsx:50`. 5 min.
4. **Renderizar erro do Notion OAuth dentro do wizard** (não HTML cru). `app/api/notion/oauth/callback/route.ts`.
5. **Confirmação ao escolher slug** ("não pode mudar depois") — modal antes de submit em `ConviteOnboardingUI.tsx`.

### P1 — Primeira semana de testes

6. **Welcome email via Resend** disparado no `consumir` do convite. 1-2h de trabalho. Conteúdo: bem-vindo + link de suporte + lembrete dos 2 steps de OAuth.
7. **GIF/screenshot no StepNotion** mostrando o popup do Notion. Reduz drasticamente abandono nesse passo.
8. **Warning em cada card do StepZernio** "Antes de conectar, verifique a sessão da conta no navegador". Texto puro, 10 min.
9. **Empty state dedicado da PostsTable.** Detectar primeiro acesso (sem filtros + zero posts) e mostrar ilustração + CTA.
10. **Hint card dismissable** no Uploader/Posts explicando o fluxo "sobe → IA gera → aprova no Notion → publica". Reduz a pergunta "por que Notion?".

### P2 — Polimento pós-validação

11. **Permitir editar slug** em Configurações (com check de unicidade global).
12. **Tour curto opcional** (Shepherd.js ou nativo) no primeiro acesso a `/app`, dismissable.
13. **Skip explícito no wizard** ("Configurar redes depois") com aviso de que precisa antes do 1º post.
14. **Indicador "qual conta de qual rede"** mais robusto no StepZernio + botão "desconectar/trocar".
15. **Detectar convite pendente em `/app`** e re-redirecionar (caso o redirect_url do Clerk falhe).
16. **Pós-`StepPronto`, checklist persistente no dashboard** "1/3 — Subir 1ª mídia, 2/3 — Aprovar no Notion, 3/3 — Ver post publicado" pra guiar o testador até o 1º post completo.

---

## Resumo executivo

Onboarding é o pilar com maior maturidade do projeto e o que mais foi corrigido a fundo nas últimas semanas (6+ commits recentes endereçando bugs do fluxo testador). O caminho-feliz é genuinamente curto e a recuperação de estado é redundante (banner + card + guard). Os buracos são de duas naturezas: (a) **ausências básicas** que produtos SaaS sérios têm (welcome email, termos/LGPD, tour, empty states com CTA), e (b) **fricção pra leigo que nunca usou Notion** ou que gerencia múltiplas contas sociais. Nenhum dos problemas críticos é caro de resolver — a maioria é < 1h cada. Recomendação: bater os P0 antes da rodada de testes humanos pra não queimar testers com débito legal e fluxos cegos.
