# Pilar 03 — Arquitetura & Código

## Nota: 7.5/10

## Justificativa

A separação de camadas é genuinamente boa para um projeto desse porte e idade. `src/` é o domínio puro (sem React/Next), `app/` é a casca Next 16, `lib-web/` é a fronteira server-only que costura os dois, `worker/` é uma fina camada cron sobre `src/maintenance/`. O split `src/config.ts` (env) vs `src/tenant.ts` (tipos/helpers) é cirúrgico e resolve o problema real de Server Component vazar `process.env` no client bundle — comentário no próprio arquivo documenta a decisão. O reuso entre CLI (`src/index.ts`) e worker é exemplar: nenhuma duplicação de pipeline, ambos consomem `src/maintenance/*`.

Typecheck passa limpo (zero erros). Build do Next 16 passa limpo (única warning é deprecação do `middleware` → `proxy`, vinda do Next). Strict mode ligado, nenhum `any` explícito no código de domínio (apenas `as never` ciente como escape hatch do SDK do Notion que tem tipos generativos pesados).

O que segura a nota em 7.5 e não 9:

1. **DRY violation grave nos leitores de Notion property** — `lerRichText/lerTitle/lerSelect/lerMultiSelect/lerUrl/lerDateStart/lerCheckbox` estão copiados em **10 arquivos**, byte-a-byte. É a primeira coisa que pula em qualquer leitura cruzada.
2. **Zero validação de input nas 20 rotas API** — todas usam `(await req.json()) as Body`. Zod é dependência do projeto e usado em `cerebro.ts`/`config.ts`, mas não chega nos route handlers. Em SaaS multi-tenant com Clerk + admin endpoints isso é dívida de segurança, não só de qualidade.
3. **Acoplamento Zernio/Notion sem boundary** — `notionDo()` e `zernioDo()` em `src/lib/clients.ts` retornam o cliente SDK cru. `src/publish/zernio.ts`, `src/maintenance/atualizarZernioAgendados.ts`, etc montam o `body` Zernio direto. Trocar Zernio por Ayrshare seria reescrever 8 arquivos. CLAUDE.md inclusive marca Zernio como "decidida, não trocar sem perguntar" — então o acoplamento é semi-intencional, mas a abstração mínima ajudaria nos testes.
4. **Dois "monstros"**: `components/Uploader.tsx` (678) e `components/PostsTable.tsx` (552). Ambos client components com estado misturado a UI. Não são bug, são manutenção difícil.
5. **Naming PT/EN inconsistente**: `loadTenantConfig`, `listarEmpresasAtivas`, `getEmpresaAtiva`, `criarLinhaAprovacao` convivem no mesmo módulo. A regra real (CLAUDE.md em PT) sugere PT, mas DB/Auth ficaram EN. Cosmético, mas é a 1ª coisa que um dev novo nota.

## Pontos fortes

- **Tipos centralizados e consistentes**: `src/types.ts` define `PlanoPublicacao`, `Rede`, `TipoVideo`, `ResultadoPublicacao`. Todo o pipeline (cérebro → redator → avaliador → agendador → publish → log) consome esses tipos. `lib-web/notionData.ts` exporta `PostListado` derivado, tipado pra UI.
- **Strict TS + zero `any`**: `tsconfig.json` com `"strict": true`, `noEmit`. Os escape hatches são `as never` em chamadas do SDK do Notion (cuja tipagem de `properties` é hostil) e dois `as unknown as Rede[]` em conversões controladas — sempre acompanhados de comentário.
- **Server↔Client boundary respeitado**: nenhum client component importa de `@/src/config` (que lê env). `components/PostsTable.tsx` importa só `type PostListado, type PatchPostInput` de `lib-web` — sem funções. Server Component (`app/app/posts/page.tsx`) busca dados e passa props serializáveis (`posts`, `clientes`, `filtros`, `ordem`).
- **Reuso CLI ↔ worker exemplar**: `worker/crons/publicarAprovadosTodas.ts` tem 5 linhas. Toda lógica vive em `src/maintenance/publicarAprovados.ts`, chamada com `(tenant, onLog) =>` pelos dois entrypoints. Zero duplicação.
- **Split `config.ts` vs `tenant.ts`**: resolve elegantemente o problema de Server Component arrastar `process.env` validation pro client bundle. Comentário inline documenta o motivo.
- **Build & typecheck limpos**: `npm run typecheck` passa em ~3s. `npm run build` compila em 2.5s, TS em 2.7s, gera todas as 33 rotas sem erro. Único warning é Next 16 cobrando rename `middleware`→`proxy` (não-bloqueante).
- **Cache de tenant config + retry no DB**: `loadTenantConfig` faz cache em memória + `comRetryDb` absorve rate-limit do Neon. Pequeno detalhe que evita avalanche em rajada de requests.
- **Erro patterns coerentes**: throws com mensagem explicativa (citando como resolver), `try/catch` capturando `err instanceof Error ? err.message : String(err)`. Os `} catch {` que aparecem em `cerebro.ts/redator.ts/avaliador.ts/agendador.ts/thumbnailAgent.ts` NÃO são silent — todos jogam um `throw new Error(...)` em seguida (catch sem variável porque o erro original do `JSON.parse` é descartável). Esse é o uso correto.

## Problemas críticos

### [ALTO] Helpers de leitura de Notion property duplicados 10x

**Local:** `src/maintenance/atualizarPendentes.ts:54-73`, `src/maintenance/publicarAprovados.ts:22-48`, `src/maintenance/atualizarZernioAgendados.ts:41-67`, `src/maintenance/repararCopy.ts`, `src/maintenance/gerarThumbnailsPeriodo.ts`, `src/maintenance/agendarTodas.ts`, `src/maintenance/avaliarCopy.ts`, `src/maintenance/cancelarAgendamento.ts`, `src/clientes/notionClientes.ts`, `lib-web/notionData.ts:66-112`
**Problema:** `lerRichText`, `lerTitle`, `lerSelect`, `lerMultiSelect`, `lerUrl`, `lerDateStart`, `lerCheckbox` são reescritos byte-a-byte em 10 arquivos. Mais que volume: significa que se um bug aparecer (ex: Notion mudar tipagem de `date.start` pra `null` em casos de timezone-only), você precisa caçar 10 lugares. Já tem `src/lib/notionChunks.ts` no mesmo lugar — falta `src/lib/notionRead.ts`.
**Correção:** Criar `src/lib/notionRead.ts` exportando todas essas 7 funções (com testes pequenos se quiser). Substituir os 10 sites. Trabalho mecânico, sem risco.

### [ALTO] Zero validação Zod em routes API

**Local:** `app/api/upload/url/route.ts:35`, `app/api/jobs/route.ts:20`, `app/api/admin/empresas/route.ts:33`, `app/api/admin/empresas/[id]/route.ts:45`, `app/api/empresas/[id]/zernio/route.ts:49`, `app/api/admin/testar/route.ts:22`, `app/api/me/empresa-ativa/route.ts:12`, `app/api/admin/empresas/[id]/membros/route.ts:35`, `app/api/admin/convites-onboarding/route.ts:34`, `app/api/posts/[pageId]/route.ts:50`, `app/api/convites-onboarding/[token]/consumir/route.ts:30`
**Problema:** Todas as 11 rotas que aceitam body usam `(await req.json().catch(() => ({}))) as Body`. Não há validação de tipo, formato, tamanho. Numa rota admin (`/api/admin/empresas/[id]`) que aceita chaves Zernio/Notion, um cliente malicioso ou bug de UI pode mandar payload arbitrário. A coerção `as` é uma mentira pro TypeScript. `zod` já é dependência do projeto.
**Correção:** Criar um schema Zod por rota e validar. Helper sugerido: `async function lerBody<T>(req, schema): Promise<{ ok: true; data: T } | { ok: false; res: NextResponse }>`. Migrar rotas críticas primeiro (admin/* e upload).

### [MÉDIO] Acoplamento direto Zernio/Notion sem boundary

**Local:** `src/lib/clients.ts:14-122` (notionDo, zernioDo, contaConfiguradaPara, etc), `src/publish/zernio.ts:209-257` (montagem do body Zernio), `src/maintenance/atualizarZernioAgendados.ts:267-289`
**Problema:** O código consome o `Zernio` SDK e o `NotionClient` direto, sem interface. Em `src/publish/zernio.ts` o body do `createPost` é montado in-line com `mediaItems`, `platformSpecificData.containsSyntheticMedia`, `scheduledFor` etc. Trocar provedor de publicação significa reescrever pelo menos `publish/zernio.ts`, `maintenance/atualizarPendentes.ts`, `maintenance/atualizarZernioAgendados.ts`, `maintenance/cancelarAgendamento.ts`. CLAUDE.md já declara "Zernio é decidido", então isso é semi-intencional, mas a falta de boundary também complica testes (mockar SDK inteiro é caro).
**Correção:** Não inventar abstração elaborada agora. Mas extrair pelo menos a montagem do body Zernio (`montarBodyZernio(plano, midia, opts)`) num helper único e centralizar em `src/publish/zernio.ts` exportado — hoje há cópias dessa lógica entre `publish/zernio.ts` e `maintenance/atualizarZernioAgendados.ts` (`dadosEspecificosYoutube` duplicado).

### [MÉDIO] `loadTenantConfig` e `loadTenantConfigById` duplicados

**Local:** `src/db/tenantConfig.ts:11-79`
**Problema:** Os corpos das duas funções são idênticos exceto pelo `.where()`. 30 linhas duplicadas. Pior: `loadTenantConfigById` não tem cache (`loadTenantConfig` tem), nem `comRetryDb`. Inconsistência sutil que pode causar 429 do Neon em rajada de jobs sem ninguém entender por quê.
**Correção:** Extrair `materializarTenant(linhaJoin)` e fazer ambas as funções chamarem. Adicionar cache+retry ao caminho `byId` (ou indexar cache por id também).

### [MÉDIO] `Uploader.tsx` (678 linhas) e `PostsTable.tsx` (552) misturando estado e UI

**Local:** `components/Uploader.tsx`, `components/PostsTable.tsx`
**Problema:** Client components grandes onde fetch, optimistic updates, polling, URL state, drag&drop e markup convivem. Manutenção e onboarding sofrem. Não é bug — é dívida cognitiva.
**Correção:** Extrair hooks customizados (`useUploadQueue`, `usePostsFilter`, `useOptimisticPatch`). Mover lógica de polling do upload pra um único `useUploadJob(jobId)`. Esforço M.

### [BAIXO] `as never` em todas as escritas Notion (15 sites)

**Local:** todos os `properties: props as never` em `src/maintenance/*`, `src/approval/notion.ts:56`, `src/clientes/notionClientes.ts:148,173`, `lib-web/notionData.ts:222,223`
**Problema:** Sintoma do mesmo problema do item 1 — escrita no Notion não tem helper tipado. O `as never` é o jeito "correto" de calar o SDK do Notion (cuja tipagem `CreatePageParameters['properties']` é uma união monstro), mas centralizar num único helper (`escreverPropriedades(notion, pageId, props)`) com o cast lá dentro pelo menos isola a mentira.
**Correção:** Helper `escreverPropriedades(...)` em `src/lib/notionWrite.ts` (já existe em `lib-web/notionWrite.ts` mas só pra patch específico). Centralizar.

### [BAIXO] Naming PT/EN inconsistente

**Local:** projeto inteiro — `loadTenantConfig` vs `listarEmpresasAtivas` (mesmo arquivo), `getEmpresaAtiva` vs `criarLinhaAprovacao`, `syncUsuarioAtual` vs `listarConvitesPendentes`
**Problema:** CLAUDE.md está em PT, código de domínio em PT, mas helpers de DB/Auth ficaram EN. Não há regra explícita. Trocar `loadTenantConfig` → `carregarConfigDaEmpresa` quebra 30+ sites. Cosmético, mas atrito real pra quem entra.
**Correção:** Documentar a regra no CLAUDE.md ("domínio + maintenance em PT; primitivos de infra — db, auth, http — em EN") e seguir nas novidades. Não refatorar o existente.

### [BAIXO] `dadosEspecificosYoutube` duplicado

**Local:** `src/publish/zernio.ts:25-31` e `src/maintenance/atualizarZernioAgendados.ts:24-30`
**Problema:** Exatamente a mesma função. Vai sair de sincronia. Sub-caso do item de boundary Zernio.
**Correção:** Mover pra `src/publish/zernio.ts` exportado, importar no maintenance.

## Recomendações priorizadas (com esforço P/M/G)

1. **[P]** Criar `src/lib/notionRead.ts` com os 7 helpers (`lerRichText`, etc) e substituir nos 10 sites. Maior ganho de DRY por linha mexida. **Tempo: 1h.**
2. **[P]** Centralizar `dadosEspecificosYoutube` e `montarConteudo` em `src/publish/zernio.ts`; importar do maintenance. **Tempo: 15min.**
3. **[M]** Helper `lerBody<T>(req, schema)` com Zod e migrar as 5 rotas admin + `/api/upload/url`. **Tempo: 2-3h.** (Resto das rotas pode vir depois.)
4. **[P]** Refatorar `loadTenantConfig`/`loadTenantConfigById` pra dividir `materializarTenant`. Aplicar `comRetryDb` ao caminho byId. **Tempo: 30min.**
5. **[M]** Criar `src/lib/notionWrite.ts` (server) com helper único `escreverPropriedades(tenant, pageId, props)` encapsulando o `as never`. Migrar os 15 sites. **Tempo: 2h.**
6. **[M]** Extrair `montarBodyZernio(plano, midia, opts)` em `src/publish/zernio.ts` e chamar dos 2 sites que hoje montam o body. Primeiro passo "sem dor" pro boundary Zernio. **Tempo: 1h.**
7. **[G]** Quebrar `Uploader.tsx` em `useUploadQueue` + `useUploadJob` + componentes UI menores. Mesmo pra `PostsTable.tsx` (`useFiltrosPosts`, `useOptimisticPosts`). **Tempo: 1 dia cada.**
8. **[P]** Documentar regra de naming no CLAUDE.md. **Tempo: 5min.**
9. **[P]** Renomear `middleware.ts` → `proxy.ts` pra eliminar a warning do Next 16. **Tempo: 5min** (literal rename + ajuste do filename, código não muda).
