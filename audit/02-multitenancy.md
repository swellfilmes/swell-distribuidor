# Pilar 02 — Multi-tenancy & Isolamento

## Nota: 7/10

## Justificativa

O modelo de dados está bem desenhado (empresas, users, empresa_users com PK
composta, tenant_secrets cifrado AES-256-GCM, jobs/convites com FK +
empresaId obrigatório) e os fluxos centrais respeitam o tenant: R2 sob
prefixo `tenants/{empresaId}/`, Notion DB ID resolvido via
`notionDbIdDo(tenant)`, Zernio cliente memoizado por TenantConfig
(`WeakMap<TenantConfig, Zernio>`), worker carrega tenant ANTES de
processar (`processarIngest(empresaId, ...)`) e o cron itera empresas com
isolamento de erro (`paraCadaEmpresa`).

O que tira pontos: (1) as rotas `/api/posts/[pageId]` e
`/api/sync-zernio` resolvem o tenant pelo cookie `empresa_slug`
(`getEmpresaAtiva`) mas NUNCA verificam que o `pageId` (ou as páginas
sincronizadas) pertencem à base Notion daquele tenant — defesa contra
IDOR depende exclusivamente de o Notion API rejeitar o `pages.retrieve`
do bot quando ele não tem acesso à página. Isso é frágil porque (a) se o
mesmo bot Notion (Internal Integration) for compartilhado por engano em
duas DBs de tenants distintos, vaza; (b) a chave OAuth do Notion criada
em `criarDistribuicaoDb` é workspace-bound — se um owner conectar 2
empresas ao mesmo workspace, vaza por construção. (2) cache em memória
de `loadTenantConfig` por slug e `cacheClientes` por slug não são
invalidados em todas as rotas de mutação (ex: `notion/oauth/callback`
chama `invalidarCache(empresa.slug)`, mas o `tenantSecrets` direto via
`atualizarEmpresa` admin sim — ok; porém `zernioCompartilhadoCache` é um
singleton process-wide que NUNCA é invalidado quando a Swell rotaciona a
key). (3) middleware Clerk não cobre `/api/jobs`, `/api/sync-zernio`,
`/api/admin`, `/api/notion`, `/api/convites-onboarding` — todas se
defendem manualmente nas handlers, mas qualquer rota nova criada sob
esses prefixos sai sem proteção por default.

## Pontos fortes

- **Modelo de dados sólido** (`src/db/schema.ts`): `empresaId` FK em
  `tenant_secrets`, `jobs`, `convites`, `convitesOnboarding`; PK
  composta em `empresa_users`; índice `jobs_empresa_idx`. Cascata
  `onDelete: cascade` previne órfãos.
- **Secrets isolados e cifrados** (`src/db/encryption.ts`): AES-256-GCM
  com IV randômico por valor; `ENCRYPTION_KEY` em env; cifragem ocorre
  em todas as escritas (`adminEmpresas.ts`, `notion/oauth/callback`,
  `empresas/[id]/zernio`).
- **R2 prefixado por tenant** (`src/storage/r2.ts:30,61`): chave
  `tenants/${tenant.empresaId}/publicar/...` em both upload direto e URL
  assinada. Impede colisão de objetos. (Embora não impeça LISTAGEM
  cross-tenant — chaves R2 são previsíveis e bucket é público.)
- **Membership-aware nas rotas de config** (`/api/empresas/[id]/zernio`,
  `/zernio-profile`, `/api/notion/oauth/start+callback`): cada uma
  recarrega `listarEmpresasDoUsuario()` e checa `e.id === empresaId`
  ANTES de qualquer mutação; o callback OAuth ainda re-verifica
  membership pós-redirect pra mitigar roubo de cookie state.
- **Worker passa empresaId explicitamente** (`worker/handlers/ingest.ts:65`):
  toda operação chama `loadTenantConfigById(empresaId)` no início e
  passa `tenant` adiante. Cron `paraCadaEmpresa` itera com try/catch
  por empresa.
- **Job claim atômico** (`worker/index.ts:46`): `UPDATE ... WHERE
  status=pending` previne duplo processamento entre workers e mantém o
  empresaId herdado da row, não há chance de cross-tenant.
- **Convites onboarding atômicos** (`consumirConviteOnboarding`):
  reserva via UPDATE com WHERE `consumido_em IS NULL`, rollback em
  falha. Race-safe.
- **Notion DB writes corretos** (`src/approval/notion.ts:55`):
  `parent: { database_id: notionDbIdDo(tenant) }` — criação sempre na
  base do tenant.

## Problemas críticos

### [ALTA] IDOR potencial em /api/posts/[pageId]
**Local:** `app/api/posts/[pageId]/route.ts:24-37` e
`app/api/posts/[pageId]/route.ts:44-57` (PATCH), via
`lib-web/notionData.ts:278-290` (`carregarPost`) e
`lib-web/notionWrite.ts:147-150` (`patchPostNoNotion`).
**Problema:** O `pageId` vem da URL e é passado direto pra
`notion.pages.retrieve({ page_id })` / `notion.pages.update`. NÃO há
verificação de que a página pertence à `notionDbIdDo(tenant)` (i.e.,
que `page.parent.database_id === tenant.notionDbId`). A defesa é
inteiramente delegada ao Notion: se o bot do tenant A tiver acesso à
página de B (Internal Integration compartilhada, ou OAuth workspace
sobreposto), qualquer usuário membro de A lê/escreve livremente em B só
trocando o pageId.
**Risco:** Vazamento e mutação cross-tenant de planos/copy/status. No
modelo Notion OAuth atual (`notion/oauth/callback`), o admin cria uma
DB nova por empresa no MESMO workspace dele se conectar duas vezes — o
bot OAuth fica com acesso às duas, transformando isso em vazamento
real, não teórico.
**Correção:** Em `carregarPost` (e dentro de `patchPostNoNotion` antes
do `pages.update`), validar
`page.parent?.database_id === tenant.notionDbId` (normalizando o
formato com/sem hífens). Tratar como 404 se não bater. Mesma validação
deve cobrir `src/lib/reconciliarCopy.ts:47` e
`src/maintenance/cancelarAgendamento.ts:64` se acessíveis via API.

### [ALTA] Singleton Zernio compartilhado nunca invalidado
**Local:** `src/lib/clients.ts:11,71,77-83`
(`zernioCompartilhadoCache`, `inicializarZernioCompartilhado`,
`garantirZernioInicializado`) e `src/db/tenantConfig.ts:93`
(`invalidarCache` só limpa o slug map, não o singleton Zernio).
**Problema:** O Zernio do tenant Swell é um singleton process-wide que
nasce no primeiro boot e nunca é descartado. Quando a Swell rotaciona
`zernioApiKey` via `/api/empresas/[id]/zernio` ou admin, o
`tenant_secrets` é atualizado e o cache de TenantConfig do slug `swell`
é invalidado — mas o `zernioCompartilhadoCache` continua segurando a
key VELHA. Em produção (worker no Railway que fica de pé), publicações
das empresas-testador continuam usando a key antiga, e se ela foi
rotacionada por suspeita de comprometimento o atacante segue podendo
publicar.
**Risco:** Janela de exposição indefinida pra credencial rotacionada
até o próximo restart do worker. Também impede troca emergencial de
key sem deploy.
**Correção:** Em `invalidarCache(slug)`, se `slug === 'swell'` setar
`zernioCompartilhadoCache = null`. Mesma coisa nas rotas POST que
atualizam Zernio key (já chamam `invalidarCache`).

### [MÉDIA] Cookie `empresa_slug` em consumir convite é httpOnly=false
**Local:** `app/api/convites-onboarding/[token]/consumir/route.ts:51-57`
**Problema:** O cookie de empresa ativa é setado com `httpOnly: false`
("empresaSelector client-side precisa ler"), mas em
`app/api/me/empresa-ativa/route.ts:28-34` o mesmo cookie é
`httpOnly: true`. Inconsistência: depois que o testador consome o
convite, JS no browser consegue ler/escrever o slug; até a próxima
troca via API ele fica acessível a XSS.
**Risco:** Se houver XSS em qualquer página /app, dá pra fazer
override do cookie e pré-condicionar requests a apontar pra outra
empresa que o user pertença (não vaza dados de empresa alheia, mas
abre vetor de confusão UX). Como o backend SEMPRE re-checa via
`listarEmpresasDoUsuario`, é menos grave que se fosse a única
verificação.
**Correção:** Trocar pra `httpOnly: true` e usar `/api/me/empresa-ativa`
GET pra ler. Ou um cookie separado `empresa_slug_public` só pra UI.

### [MÉDIA] Middleware Clerk não cobre rotas API críticas
**Local:** `middleware.ts:3-9`
**Problema:** `isProtectedRoute` lista
`/api/me`, `/api/empresas`, `/api/posts`, `/api/upload` — mas falta
`/api/jobs`, `/api/sync-zernio`, `/api/admin`, `/api/notion`,
`/api/convites-onboarding`. Hoje cada handler chama
`syncUsuarioAtual()` ou `exigirAdmin()` manualmente, então não há
vazamento; mas é frágil — qualquer rota nova nesses prefixos sai
desprotegida.
**Risco:** Bug latente. Se alguém esquecer o check em uma rota nova
sob `/api/jobs/*`, vira lista pública. Já aconteceu de
`/api/convites-onboarding/[token]` (GET) ser intencionalmente público,
o que mistura semântica.
**Correção:** Adicionar `/api(.*)` em `isProtectedRoute` e excluir
explicitamente a rota pública `/api/convites-onboarding/[token]` (sem
o `/consumir`). Defesa em profundidade.

### [MÉDIA] Notion fallback `process.env.NOTION_CLIENTS_DB_ID`
**Local:** `src/db/tenantConfig.ts:40,71`
**Problema:** Se um tenant não tem `notionClientsDbId` setado, cai pra
`process.env.NOTION_CLIENTS_DB_ID` — que é a DB de clientes da Swell.
Empresa-testador sem clients DB própria acaba lendo/escrevendo clientes
da Swell.
**Risco:** Vazamento de lista de clientes Swell pra tenants que ainda
não configuraram a DB própria. Operação multi-cliente em
`src/clientes/notionClientes.ts` opera sobre essa DB.
**Correção:** Remover o fallback ou condicionar a `slug === 'swell'`.

### [BAIXA] Bucket R2 público + chaves previsíveis permitem enumeração
**Local:** `src/storage/r2.ts:44-46,72-74` (`R2_PUBLIC_BASE_URL`)
**Problema:** As chaves seguem `tenants/{id}/publicar/{ISO}__{nome}`.
URLs públicas servidas direto do R2 público, sem assinatura de read.
Se um atacante advinha `empresaId` (são serial autoincrement) e nome
de arquivo (com timestamp ISO), pode tentar enumerar. Mais grave:
nada impede tenant A de receber URL pública e dar pra terceiros.
**Risco:** Baixo — vídeo precisa estar PUBLICAMENTE acessível pro
Zernio puxar. Por design. Mas R2 não tem listing público, então só
enumeração por força bruta — viável só se nome do arquivo for
adivinhável.
**Correção:** Considerar key prefixo com sufixo aleatório
(`tenants/{id}/{nanoid()}/{nome}`) pra tornar URL não-adivinhável.
Adiar conforme nota do CLAUDE.md (R2 limpeza adiada).

### [BAIXA] `/api/admin/testar` aceita Notion+Zernio keys arbitrárias
**Local:** `app/api/admin/testar/route.ts:30-44,53-69`
**Problema:** Endpoint admin-only, mas faz fetch externo com
credenciais do body. Logado num admin comprometido, dá pra usar a
infra Swell pra testar keys roubadas (oracle gratuito + esconde IP de
origem).
**Risco:** Baixo. Só admin acessa. Mais um ponto de hygiene.
**Correção:** Rate-limit por user; logar uso.

## Recomendações priorizadas

1. **(URGENTE)** Adicionar guard
   `assertPagePertenceAoTenant(tenant, page)` em `carregarPost` e na
   PATCH antes do `notion.pages.update` — eliminar IDOR.
2. **(URGENTE)** Invalidar `zernioCompartilhadoCache` quando key da
   Swell é atualizada (em `invalidarCache('swell')` e nas rotas POST
   que tocam `zernioApiKey`).
3. **(URGENTE)** Estender `middleware.ts` pra `/api(.*)` com lista
   explícita de exceções públicas (callback OAuth, validar convite).
4. Remover fallback `process.env.NOTION_CLIENTS_DB_ID` pra tenants ≠
   swell em `tenantConfig.ts`.
5. Mudar cookie `empresa_slug` pra `httpOnly: true` consistente em
   todos os setters; expor slug ativo via endpoint server-side.
6. Adicionar coluna `tenant_id` redundante em audit logs e criar
   teste automatizado (vitest) que prova IDOR fechado (user de A
   tenta `GET /api/posts/<pageId-de-B>` → 404).
7. Considerar Row-Level Security do Postgres (Neon suporta) como
   defesa em profundidade: política `WHERE empresa_id = current_setting('app.empresa_id')`
   evita esquecimento de filtro em queries futuras.
8. Mudar `empresas.id` de `serial` pra `uuid` ou nanoid pra não
   expor cardinalidade de tenants em URLs `/api/empresas/[id]/*`.
9. Logar/alertar quando `loadTenantConfig` é chamado pra tenant em
   ciclo (detecção de tentativa de IDOR).
10. Criar checklist de revisão de PR: "toda nova rota /api/* tem
    auth check no topo?" + linter custom se possível.
