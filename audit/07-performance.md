# Auditoria — Pilar 07: Performance & Escalabilidade

**Data:** 2026-06-30
**Auditor:** Claude (Opus 4.7)
**Escopo:** worker, ffmpeg/ingest, R2, Notion, Zernio, DB Neon, frontend Next, crons, polling

---

## Nota: **6.5 / 10**

> Decisões de arquitetura defensivas e bem justificadas (`MAX_CONCURRENCY=1`,
> ffmpeg sequencial, streaming via URL pra >200MB, `neon-http`, `force-dynamic`
> em tudo). Mas o sistema está calibrado pra **um usuário por vez no Railway
> Hobby**: sem cache de prompts, sem batch Zernio nos crons, sem cache HTTP
> de listagem do Notion, e crons sobrepostos em multi-tenant com I/O sequencial
> não escalam pra 10+ empresas ativas. Funciona pra 1-3 tenants × poucos posts;
> dores começam quando virar 10+ tenants × 100+ posts/empresa.

---

## Justificativa

A stack tem várias decisões corretas sob restrição de memória:

- **`MAX_CONCURRENCY=1` no worker** (`worker/index.ts:21`): seguro dado o
  histórico de OOM. Não é gargalo agora porque o tráfego é baixo. Vira gargalo
  quando 2 usuários subirem vídeos juntos — o segundo espera o primeiro
  terminar (ffmpeg de 6 frames + 2 chamadas Claude + thumbnail + Notion
  write = ~30s–2min por job).
- **ffmpeg sequencial** (`src/ingest/extrairFrames.ts:48-61`): comentário
  explica bem ("6 ffmpegs em paralelo abre o vídeo inteiro na memória"). É a
  call certa. **Mas:** com `-ss` antes de `-i` o ffmpeg já faz fast seek, então
  o custo de memória não é "vídeo inteiro" — é decode do segmento. Poderia
  testar `Promise.all` de 2-3 ffmpegs com `-ss antes` se o Railway subir RAM.
- **Streaming via URL R2 pra vídeos ≥200MB** (`worker/handlers/ingest.ts:22`):
  excelente. Evita download + escrita em /tmp pra arquivos grandes. ffmpeg usa
  HTTP range requests. Pena que isso desliga geração de thumbnail (linha 179)
  — vídeos grandes ficam sem thumb custom.
- **Neon HTTP driver** (`src/db/index.ts:6`): perfeito pra serverless. Não tem
  "connection pool" tradicional, cada query é fetch. Não há leak. Mas: tem
  overhead de TLS handshake por query — pra `force-dynamic` em SSR isso é
  noticeable (TTFB +50-150ms vs pool tradicional).
- **`force-dynamic` em todas as páginas**: corretíssimo dado que cada
  request precisa do usuário Clerk + empresa ativa do cookie. Mas perde a
  oportunidade de cachear a **lista de clientes** (já tem cache in-memory
  por TTL 10min em `notionData.ts:306`) e **dados estáticos do shell**.
- **Notion sem batch**: cada `atualizarPendentes` chama `zernio.getPost` 1x
  por linha sequencialmente (`src/maintenance/atualizarPendentes.ts:146-155`).
  Pra 50 posts agendados num cron, 50 round-trips Zernio sequenciais
  = ~25s. Multiplica por N empresas.
- **Crons multi-tenant** rodam empresas em sequência
  (`worker/crons/comum.ts:27`), não em paralelo. Com 10 empresas e cron */5min,
  começa a empilhar.

---

## Pontos fortes

1. **FFmpeg sequencial documentado**
   (`src/ingest/extrairFrames.ts:46-61`) — comentário descreve o trade-off com
   precisão. Sem isso, dev futuro paraleliza "por intuição" e o Railway mata
   o processo.
2. **Limite de stream de 200MB** (`worker/handlers/ingest.ts:22-23`) — corte
   inteligente: arquivos pequenos baixa pro /tmp (ffmpeg local é mais rápido
   em 6 calls sucessivas); arquivos grandes streama. Linha 78-93 implementa
   com fallback gracioso.
3. **Reset de jobs órfãos no boot** (`worker/index.ts:200-208`) — se Railway
   matar o container no meio de um job, na próxima boot ele volta pra
   `pending`. Mata "jobs zumbis".
4. **Claim atômico de jobs** (`worker/index.ts:35-58`) — `UPDATE ... WHERE
   status=pending` na cláusula garante que 2 workers concorrentes não pegam o
   mesmo job. Pronto pra escalar pra N réplicas.
5. **Cache TTL pra `clientesDaEmpresa`** (`lib-web/notionData.ts:306-321`) —
   evita 2 chamadas Notion na página `/app/posts`.
6. **Retry com backoff em DB** (`src/db/retry.ts`) — captura 429 do Neon free
   tier e retenta com jitter.
7. **Presigned URL TTL 1h** (`src/storage/r2.ts:71`) — 10min seria curto pra
   vídeos 5GB em conexão residencial; ajuste foi feito após observação real.
8. **Índice composto `(status, criado_em)` em `jobs`**
   (`src/db/schema.ts:117`) — query do worker (`status=pending ORDER BY criado_em ASC`)
   bate exatamente.
9. **`serverExternalPackages`** (`next.config.ts:8`) — evita bundlar SDK
   pesado (`@aws-sdk`, `@anthropic-ai`, `@notionhq`) no client.

---

## Problemas críticos

### 1. Sem prompt caching nas chamadas Claude
**Path:** `src/brain/cerebro.ts:152,233`, `src/brain/redator.ts:83`,
`src/brain/avaliador.ts:100`, `src/brain/thumbnailAgent.ts:92`

Cada ingest dispara 2-4 chamadas Claude Sonnet 4.6 com **prompt do sistema
estável** (guia de cliente, regras de tom, instrução JSON). Sem
`cache_control: { type: 'ephemeral' }` no system prompt, o usuário paga
$3/MTok input full toda vez. Pra um pipeline com Sonnet 4.6, ativar
prompt caching reduz **~80% do custo de input** dos prompts repetidos
(tom Swell + instruções de schema JSON são idênticos em todo ingest).

**Impacto:** custo OPEX. Performance da request fica similar (caching
não acelera, só barateia), mas a $/post escala linearmente sem isso.

### 2. `atualizarPendentes` faz N round-trips Zernio sequenciais
**Path:** `src/maintenance/atualizarPendentes.ts:146-155`

Loop `for (const linha of linhas) { await zernio.getPost(...) }`. Pra 50
posts pendentes, ~25s de wall-clock. Cron `*/15min` em 10 empresas = 4 min
de wall-clock total. Zernio SDK não foi auditado pra suporte a batch, mas
`Promise.all` com concorrência limitada (4-8) reduziria 5x.

**Impacto:** crons demoram mais que deveriam; com 20+ tenants ativos, o cron
de */5min começa a não terminar antes do próximo disparo (sem `protect:
true` em vez de fila — mas tem `protect: true` em `worker/index.ts:167`,
então perde ciclos silenciosamente).

### 3. Vídeo streamed da URL **pula thumbnail custom**
**Path:** `worker/handlers/ingest.ts:179-181`

```ts
} else if (streamarDaUrl) {
  log('vídeo grande streamed — pulo agent de thumbnail (Zernio gera uma da URL).');
}
```

Vídeos ≥200MB ficam **sem thumbnail otimizada** — Zernio escolhe um frame
qualquer (geralmente o primeiro, que tende a ser preto/transição). Esses
são exatamente os vídeos mais importantes (aftermovies, minidocs). Solução:
extrair só o frame escolhido em hi-res via ffmpeg-from-URL (1 chamada, low
mem) e subir no R2.

### 4. `clientesDaEmpresa` busca **TODOS os posts** pra extrair clientes únicos
**Path:** `lib-web/notionData.ts:309-321` chama `listarPostsDoNotion(tenant,
{})` sem filtros, retorna até 100 (page_size limit). Vê apenas os últimos
100 posts da empresa. **Pra empresas com 200+ posts, clientes antigos somem
do filtro dropdown.**

Pior: o cache é por instância de runtime (Vercel serverless = cold start
zera cache). Cada cold start faz 1 query Notion completa.

**Fix:** materializar lista de clientes únicos numa coluna dedicada
(empresa-level no DB) atualizada via trigger ou em `criarLinhaAprovacao`.

### 5. Polling client-side de 20min com fetch a cada 3s
**Path:** `components/Uploader.tsx:13,436`

`POLLING_TIMEOUT_MS = 20 * 60 * 1000` + `setInterval(tick, 3_000)`. Pra
N uploads simultâneos isso dispara N chamadas/3s. Pra um vídeo de 5GB,
~400 requests `GET /api/jobs/:id`. Cada uma com `force-dynamic` →
Clerk auth + Neon round-trip. Multiplique por 5 usuários simultâneos
= 2.000 requests no Vercel em 20min.

**Fix:** usar SSE ou WebSocket pra um único stream, ou aumentar intervalo
após primeiro tick com backoff (3s → 5s → 10s).

### 6. Crons multi-tenant rodam empresas em SEQUÊNCIA
**Path:** `worker/crons/comum.ts:27` (`for (const e of empresas) { await
rotina(...) }`)

Pra 1 empresa OK. Pra 10 empresas, cron `*/5min` faz 10x I/O sequencial
(Notion query + Zernio query + Notion update). Se cada empresa leva 20s,
10 empresas = 200s. Próximo tick em 100s → `protect: true` pula. Resultado:
**posts atrasados em escala**.

### 7. Single-shot R2 PUT em vídeos de 5GB (sem multipart)
**Path:** `src/storage/r2.ts:34-42, 71`

`PutObjectCommand` com `Body: createReadStream` faz upload single-shot.
R2 aceita até 5TB single-shot, então tecnicamente funciona, mas:
- presigned PUT não suporta resume; conexão cai = começa do zero.
- usuário com conexão instável e arquivo de 5GB pode nunca terminar.

Browser usa XHR `xhr.send(arquivo)` (`Uploader.tsx:149`) — mesmo problema.

**Fix:** multipart presigned (`CreateMultipartUpload` + `UploadPart`) pra
>100MB. Permite resume e paralelo.

### 8. Página `/app/posts` busca **100 posts max** sem paginação
**Path:** `lib-web/notionData.ts:218,224`

`const limit = Math.min(opts.limit ?? 100, 100)`. Com 1000 posts/empresa,
usuário vê só os 100 mais recentes. Filtros estão no Notion, mas não há
"próxima página" no UI nem cursor pra ir pra mais antigos. Vai cair em
reclamação direta.

### 9. Cron `atualizar-pendentes` busca **TODAS** as páginas com status
pendente sem cursor com page_size baixo
**Path:** `src/maintenance/atualizarPendentes.ts:26-49`

Paginação até esgotar (`do...while cursor`). Sem cap. Empresa que acumular
500 pendentes (esquecida ou bug) faz cron rodar 5+ queries Notion + 500
queries Zernio sequenciais. **Sem timeout, o cron pode rodar mais que o
próximo tick e ser pulado por `protect: true`.**

### 10. Bundle frontend tem múltiplos client components grandes
**Path:** `components/PostsTable.tsx` (552 LOC), `Uploader.tsx` (678 LOC),
`PostDetailDrawer.tsx` (452 LOC), `EmpresaForm.tsx` (341 LOC),
`CalendarView.tsx` (275 LOC)

Total `'use client'` files: ~16 com ~3.500 LOC combinadas. `Uploader.tsx`
+ `PostsTable.tsx` na primeira carga de `/app/upload` e `/app/posts`
respectivamente. Sem code-splitting por rota explícito, sem lazy import
do `CalendarView` que só roda se `viewMode === 'calendario'`. **Provável
JS bundle inicial >200KB compressed só de app code.**

### 11. `notionDo` cacheia client por **WeakMap[TenantConfig]**
**Path:** `src/lib/clients.ts:5-6, 21-25`

Como `loadTenantConfig` cria um **novo objeto** a cada cold start, o
WeakMap nunca acumula entre serverless invocations. Em dev/worker
persistente OK. Em Vercel Functions, sempre cria novo client (HTTP
keep-alive perdido). Notion SDK não tem custo grande pra instanciar, mas
o Zernio + AWS S3 client têm.

### 12. `loadTenantConfigById` não usa cache (apenas `loadTenantConfig(slug)`)
**Path:** `src/db/tenantConfig.ts:54-79` vs `:11-51`

Worker bate `loadTenantConfigById` em **todo job** + **todo cron** + **toda
empresa do cron**. Pra 10 empresas × 3 crons × 12 ciclos/h = 360
queries DB/h sem necessidade. Cache decrypt é seguro porque chaves não
mudam frequentemente; invalidação já existe em `invalidarCache`.

---

## Recomendações priorizadas

### P1 — Imediato (1-2 dias)

1. **Ativar prompt caching no Claude** — adicionar `cache_control:
   { type: 'ephemeral' }` ao system prompt do cérebro/redator/avaliador.
   Economia direta de OPEX, ~80% input cost de chamadas repetidas.
   Files: `src/brain/cerebro.ts`, `redator.ts`, `avaliador.ts`,
   `thumbnailAgent.ts`.
2. **Limitar polling do Uploader com backoff** —
   `components/Uploader.tsx:436`: 3s → 5s → 10s → 15s após primeiro tick
   sem mudança de status. Reduz ~3x requests pra jobs longos.
3. **Cachear `loadTenantConfigById`** com TTL curto (1-5min) — `src/db/
   tenantConfig.ts:54`. Já há padrão de cache em `loadTenantConfig(slug)`,
   só replicar.
4. **Thumbnail pra vídeos grandes (streamed)** — `worker/handlers/
   ingest.ts:179-181`: rodar `extrairFramesViaUrl(url, 6)` (que já existe
   conceitualmente — usa ffmpeg lendo da URL), avaliar com Claude vision,
   extrair só o frame escolhido em hi-res da URL via ffmpeg `-ss <t> -i
   <url> -frames:v 1`. Custo: 1 extra GET no R2.

### P2 — Antes de escalar pra 10+ tenants (1 semana)

5. **Paralelizar crons multi-tenant** — `worker/crons/comum.ts:27`: usar
   `Promise.all` com concorrência limitada (3-5 empresas em paralelo).
   Mantém isolamento de erro por empresa.
6. **Batch Zernio em `atualizarPendentes`** — `src/maintenance/
   atualizarPendentes.ts:146`: `Promise.all` com pool de 4-6
   `zernio.getPost`.
7. **Materializar lista de clientes** — adicionar coluna `clientes_cache`
   (text array) em `empresas` ou tabela `empresa_clientes (empresa_id, cliente,
   ultimo_uso)`. Atualizar em `criarLinhaAprovacao`. Substitui
   `clientesDaEmpresa` que faz query completa.
8. **Paginação na tabela de posts** — `lib-web/notionData.ts:218`: aceitar
   `cursor` e retornar `hasMore + nextCursor`. UI fica com "carregar mais"
   ou paginação tradicional.

### P3 — Quando passar de 50 tenants ativos (1 mês)

9. **Multipart upload no R2** — `src/storage/r2.ts:54`: implementar
   `createMultipartUploadPresigned()` com chunks de 100MB. Browser
   precisa orquestrar (lib `@aws-sdk/lib-storage` no browser, ou
   manual). Solução de fato pra 5GB em conexão residencial instável.
10. **Lazy-import do CalendarView e PostDetailDrawer** — `next/dynamic`
    com `ssr: false`. Tira ~727 LOC de JS do initial bundle da página
    de posts.
11. **Substituir polling por SSE em /api/jobs/[id]** — usar
    `ReadableStream` pra empurrar mudanças. Reduz N×400 requests pra 1
    long-lived connection.
12. **Considerar `pg` pool em vez de `neon-http`** — quando volume passar
    de ~1k queries/min, HTTP per-query vira gargalo de TTFB. Vercel Edge
    Functions com Hyperdrive ou Neon Pool ajudam.
13. **Cron timeout / circuit breaker** — adicionar `Promise.race` com
    timeout (4min pro */5min, 8min pro */10min) pra evitar tick perdido.

### P4 — Polish

14. **Pre-warm Notion/Zernio clients no boot do worker** — instanciar 1x
    por tenant ativo. Hoje cria a cada job/cron.
15. **Métricas Prometheus / structured logs** — quantificar tempo por
    fase (ffmpeg, Claude, Notion, Zernio) pra calibrar P1-P3 em vez de
    intuição.

---

## Apêndice: complexidade por superfície

| Superfície | Queries/op | Hot path? | Risco escala |
|---|---|---|---|
| `/api/posts GET` | 2 Notion (posts + clientes cached) | Sim (cada nav) | Médio (page_size 100) |
| `/api/jobs/[id] GET` (polling) | 1 DB + 1 Clerk | **Muito** (a cada 3s) | Alto |
| `/api/upload/url POST` | 1 DB (dedupe) + 1 R2 presign | Sim | Baixo |
| `/api/jobs POST` | 1 DB insert | Sim | Baixo |
| worker ingest 1 job | 1 DB + 6 ffmpegs + 2-4 Claude + 1-N R2 PUT + 5-15 Notion | Por job | **Alto** (memória) |
| cron publicar-aprovados (1 empresa) | N Notion queries + N Zernio creates + N Notion updates | A cada 5min × N empresas | Alto se N crescer |
| cron atualizar-pendentes (1 empresa) | N Notion + N Zernio gets sequencial + N Notion | A cada 15min × N empresas | Alto |
| cron sincronizar-edits (1 empresa) | N Notion + N Zernio updates + N Notion | A cada 10min × N empresas | Alto |

Fim.
