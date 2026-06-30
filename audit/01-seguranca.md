# Pilar 01 — Segurança & Secrets
## Nota: 6.5/10

## Justificativa

O projeto acerta no básico que muito SaaS pequeno erra: segredos por tenant são cifrados com AES-256-GCM em `src/db/encryption.ts` usando uma `ENCRYPTION_KEY` master de 32 bytes; nenhum `.env` está commitado (`.gitignore` cobre `.env`, `.env.local`, `*.pem`, `*.key`); a autenticação é toda terceirizada para o Clerk via `middleware.ts` com `clerkMiddleware` + `createRouteMatcher` cobrindo `/app(.*)`, `/api/me`, `/api/empresas`, `/api/posts`, `/api/upload`; o OAuth do Notion implementa `state` + cookie HttpOnly com nonce e re-verifica que o user é membro da empresa antes de gravar o token. A separação `src/config.ts` (server-only) vs `src/tenant.ts` (frontend-safe) evita vazar `process.env` no client. O esquema multi-tenant tem `empresaId` nas tabelas críticas e as rotas que recebem `[id]` confirmam membership via `listarEmpresasDoUsuario()` antes de mutar.

Por outro lado, o pilar tem buracos importantes que impedem a nota subir: NENHUMA das ~20 rotas de API usa `zod` para validar input (apesar de `zod` estar instalado e usado em `src/config.ts`); o casting é todo `as Body` em cima de `req.json().catch(() => ({}))`, o que aceita silenciosamente payloads malformados, campos a mais (mass-assignment latente em `atualizarEmpresa`), tipos errados, e nunca limita tamanho do JSON. A rota `/api/upload/url` aceita qualquer `contentType` que comece com `video/` ou `image/`, sem checar tamanho máximo, sem assinatura PUT com Content-Length-Range, e gera URL presigned válida por 1h — qualquer membro pode subir um arquivo de 50 GB e estourar o R2. Não há rate-limiting em rota nenhuma (login, upload, OAuth start, convites — todos abertos a brute-force/abuse de quem tiver sessão). Sem cabeçalhos de segurança em `next.config.ts` (sem CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy). Há também 7 vulnerabilidades de npm (1 high em `form-data`, 6 moderate em `next/postcss/esbuild`).

Resumo: cripto e auth bem feitos, validação e hardening estão no básico.

## Pontos fortes

- **Cripto de segredos por tenant correta:** AES-256-GCM com IV aleatório de 12 bytes + AuthTag de 16 bytes (`src/db/encryption.ts`). Formato canônico `base64(iv|tag|ciphertext)`, validação de tamanho da chave, lança se ENCRYPTION_KEY != 32 bytes.
- **`.gitignore` blinda credenciais:** cobre `.env`, `.env.local`, `*.pem`, `*.key`, `google-service-account.json`. Confirmei via `git ls-files` que só `.env.example` está versionado.
- **Auth centralizada via Clerk middleware** com matcher amplo (`middleware.ts:18-23`); todo `/api/*` é protegido por padrão exceto rotas explicitamente públicas. `syncUsuarioAtual()` (`lib-web/auth.ts`) espelha user no banco e gerencia roles em transação.
- **OAuth Notion implementa CSRF state corretamente** (`app/api/notion/oauth/start/route.ts:47` gera nonce com `randomBytes(24)`, callback re-valida `nonce !== state` em `callback/route.ts:72` e re-confirma membership da empresa no callback — defesa contra session-fixation).
- **Multi-tenant authorization consistente nas rotas críticas:** `app/api/posts/[pageId]/route.ts`, `/jobs/[id]`, `/empresas/[id]/zernio`, `/empresas/[id]/zernio-profile` todas chamam `listarEmpresasDoUsuario()` + verificam membership antes de retornar/mutar. Não rolou IDOR óbvio nesses paths.
- **Convite-onboarding tem token URL-safe de 24 bytes (~190 bits)** e é race-free via UPDATE atômico `WHERE consumido_em IS NULL` (`lib-web/convitesOnboarding.ts:127-145`).
- **HTML de erro no callback Notion escapa entities** (`callback/route.ts:27-30`) — não rolou XSS reflected aí.
- **Split server-only de `src/config.ts`** documentado em `project_config_vs_tenant_split.md`; client bundle não puxa env-vars sensíveis.

## Problemas críticos

### [Severidade: ALTO] Zero validação de input com zod em todas as 20 rotas /api/*
**Local:** `app/api/**/*.ts` (todos), e.g. `app/api/posts/[pageId]/route.ts:50`, `app/api/empresas/[id]/zernio/route.ts:49`, `app/api/jobs/route.ts:20-26`, `app/api/admin/empresas/route.ts:33`, `app/api/admin/empresas/[id]/route.ts:45`.
**Problema:** Padrão de toda rota é `const body = (await req.json().catch(() => ({}))) as Body`. Nenhuma rota usa `zod` apesar de ele estar no `package.json` (linha 34) e ser usado em `src/config.ts`. Validação manual cobre só campos individuais — não há limites de comprimento, tipos não são checados em runtime, e o `as` esconde campos extras.
**Risco:** Aceita NaN/Infinity em `tamanhoBytes` (DoS em dedupe), strings gigantes em `Body.notionApiKey` (memória), arrays gigantes em `redes`, e mass-assignment em `atualizarEmpresa` (passa `as AtualizarEmpresaInput`). Em `app/api/posts/[pageId]/route.ts` PATCH, o `body.copy` é repassado direto pro Notion sem cap de tamanho — um attacker membership pode encher posts com payload absurdo. Em `/api/jobs` o `payload` é `Record<string, unknown>` totalmente livre e gravado em jsonb.
**Correção:** Criar `lib-web/validators.ts` com schemas `zod` por rota (`PatchPostSchema`, `BodyUploadUrlSchema`, `ZernioPatchSchema`, etc.) e `const body = Schema.parse(await req.json())` em vez de cast. Aplicar `.max()` em todos os strings/arrays. Erros de validação retornam 400 com mensagens estruturadas.

### [Severidade: ALTO] Presigned upload sem tamanho máximo nem Content-Length-Range
**Local:** `src/storage/r2.ts:54-75` (`gerarUrlAssinadaUpload`), consumida em `app/api/upload/url/route.ts:93-95`.
**Problema:** A URL assinada tem TTL de 1h e SÓ amarra `ContentType`; não amarra `ContentLength`, `Content-Length-Range`, nem cap de tamanho. O comentário "vídeos até 5GB" é aspirational — o limite real é "infinito até o R2 cortar". Body do POST tem `tamanhoBytes` opcional (`tamanhoBytes?: number`), mas é só usado pra dedupeKey, nunca validado contra um teto.
**Risco:** Qualquer user logado em qualquer empresa pode subir terabytes ao R2, custando dinheiro e potencialmente derrubando o ingest worker (extrai frames com ffmpeg). Combinado com a falta de rate-limit, um usuário comprometido vira torneira aberta de custo.
**Correção:** (1) Receber `tamanhoBytes` obrigatório e rejeitar acima de 6 GB. (2) Trocar `PutObjectCommand` por **policy-based POST** (presigned POST com `Conditions: [['content-length-range', 0, 6_000_000_000]]`) ou validar via signed PUT com header `Content-Length` obrigatório no signing (`unsignableHeaders` ajustado). (3) Quota por tenant (bytes acumulados em `tenant_secrets` ou `empresas`).

### [Severidade: ALTO] Sem rate-limiting em rota nenhuma
**Local:** todas as rotas em `app/api/**`.
**Problema:** Procura por `rateLimit|ratelimit|rate-limit` retorna zero hits relacionados ao app (só rate-limit do Neon DB). O Clerk protege login, mas tudo depois disso (POST `/api/jobs`, POST `/api/upload/url`, POST `/api/admin/convites-onboarding`, GET `/api/notion/oauth/start`, POST `/api/empresas/[id]/zernio-profile` que chama Zernio externo) está aberto.
**Risco:** Membro malicioso pode criar 1M jobs (encher fila + custar Claude), forçar OAuth start em loop, esgotar cota do Zernio, ou abusar `/api/admin/testar` (admin only mas chama Zernio). Convite-onboarding `GET /api/convites-onboarding/[token]` é PÚBLICO e permite token enumeration sem throttle (24 bytes ainda é ok contra brute, mas vale defender).
**Correção:** Usar `@upstash/ratelimit` + Redis (ou edge KV) com chave por `userId+rota`. Limites: upload-url 30/min, jobs 60/min, admin-testar 10/min, public-convite 20/min/IP.

### [Severidade: MÉDIO] Vulnerabilidade HIGH em form-data + 6 moderate em next/postcss/esbuild
**Local:** `package-lock.json` — `form-data@4.0.0-4.0.5` (CRLF injection, GHSA-hmw2-7cc7-3qxx), `next@<16.3.0` (depende de postcss vulnerável CVE XSS), `esbuild@<0.24.2` (dev-server CORS bypass).
**Problema:** `npm audit` lista 1 high + 6 moderate. form-data CRLF é exploitable se algum endpoint enviar dados controlados pelo user via multipart (zernio SDK pode fazer isso ao subir vídeo).
**Risco:** Injeção em headers multipart em uploads outbound; XSS via PostCSS em build se algum CSS de tenant vazar; dev-server esbuild expõe arquivos locais em Windows.
**Correção:** `npm audit fix` (sem `--force` evita downgrade do drizzle-kit). `form-data` upgrade pra >=4.0.6. Avaliar `next@latest` em ambiente de staging.

### [Severidade: MÉDIO] Sem cabeçalhos de segurança em next.config.ts
**Local:** `next.config.ts` (todo o arquivo, 18 linhas).
**Problema:** Sem `headers()` configurado. Não há CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Vercel adiciona alguns por padrão mas nada estrito.
**Risco:** Clickjacking via iframe em painel admin; MIME-sniffing; vazamento de referer pra Notion/Zernio; sem HSTS preload força HTTPS apenas via redirect.
**Correção:** Adicionar `async headers()` retornando: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Frame-Options: DENY` (ou `frame-ancestors 'none'` via CSP), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. CSP requer cuidado por causa do Clerk — começar em report-only.

### [Severidade: MÉDIO] Cookie `empresa_slug` setado com httpOnly:false (acessível via JS)
**Local:** `app/api/convites-onboarding/[token]/consumir/route.ts:53` (`httpOnly: false`); contraste com `app/api/me/empresa-ativa/route.ts:29` que usa `httpOnly: true` pro mesmo cookie.
**Problema:** Inconsistência: o mesmo cookie de empresa-ativa é setado HttpOnly em um endpoint e não-HttpOnly em outro ("comentário: empresaSelector client-side precisa ler"). Hoje qualquer XSS conseguiria trocar a empresa ativa.
**Risco:** Em conjunto com qualquer XSS futuro (e não existem proteções de CSP), um script injetado pode forçar troca de empresa pra exfiltrar dados de outra empresa onde o user também é membro. Não é crítico hoje (sem XSS conhecido), mas o padrão é ruim.
**Correção:** Sempre HttpOnly. Pro EmpresaSelector ler a empresa ativa, expor via `/api/me/empresa-ativa` GET, ou usar Server Component que injeta como prop. Remover dependência client de ler cookie.

### [Severidade: MÉDIO] Vazamento de mensagens de erro raw no response
**Local:** padrão em quase TODAS as rotas, ex. `app/api/upload/url/route.ts:98`, `app/api/empresas/[id]/zernio/route.ts:80-82`, `app/api/notion/oauth/callback/route.ts:117` (`JSON.stringify(tokenJson).slice(0,400)` — pode incluir mensagem do Notion com dados sensíveis), `app/api/admin/testar/route.ts:42-44` (mensagem da Notion API direto no body).
**Problema:** Erros são repassados como `err instanceof Error ? err.message : String(err)`. Mensagens do AWS SDK, Notion, Zernio podem conter URLs internos, IDs de conta, IDs de chave de acesso (R2 erros incluem o `accessKeyId` em alguns casos).
**Risco:** Reconhecimento. Stack traces, paths de servidor, IDs internos vazam pra browser.
**Correção:** Wrapper `respondError(err)` que loga full em servidor (com `console.error`) e responde com `{ error: 'Erro interno', traceId: <uuid> }` para 5xx. Mensagens user-friendly só para 4xx esperados.

### [Severidade: MÉDIO] Endpoint público `/api/convites-onboarding/[token]` permite enumeração de tokens
**Local:** `app/api/convites-onboarding/[token]/route.ts:10-21`.
**Problema:** Rota PÚBLICA (não-autenticada) responde 404 vs 410 dependendo se token existe ou foi consumido. Diferencia "não existe" de "já usado" → leak de info. Sem rate-limit. Token tem 190 bits, brute é inviável, mas timing/oracle ainda revela informações.
**Risco:** Atacante consegue saber QUE existe um convite consumido (telemetria de quem foi onboarded).
**Correção:** Devolver sempre 410 ou um corpo `{ ok: false }` neutro, sem distinguir motivos pra request não autenticada. Adicionar rate-limit por IP.

### [Severidade: BAIXO] Redirect base hardcoded com fallback default-pode-ser-errado
**Local:** `app/api/empresas/[id]/zernio-profile/route.ts:15`.
**Problema:** `const REDIRECT_BASE = process.env.ZERNIO_REDIRECT_BASE_URL || 'https://project-42hj6.vercel.app';` — hardcode de URL Vercel. Se a env não estiver setada em outro ambiente, redireciona pra preview deploy de outra pessoa.
**Risco:** Não é "open redirect" clássico (não vem do user), mas confia em env não-validada. Se algum atacante registrar `project-42hj6.vercel.app` (subdomínio reciclado), captura tokens OAuth.
**Correção:** Validar com zod no boot (`requireUrl`); throw se ausente em produção. Mover pra `src/config.ts` para garantir validação centralizada.

### [Severidade: BAIXO] R2_PUBLIC_BASE_URL não checado contra origens internas (defesa SSRF)
**Local:** `src/storage/r2.ts:44, 72`.
**Problema:** Vídeos hospedados no R2 viram URLs públicas concatenadas com `R2_PUBLIC_BASE_URL`. URLs são repassadas pra Zernio e Notion. Não há defesa explícita contra SSRF aqui (não tem proxy nosso, mas vale notar que Notion/Zernio fetch'am essas URLs como server-side requests). Se o admin trocar `R2_PUBLIC_BASE_URL` por algo apontando pra interno (`http://169.254.169.254` em ambiente self-hosted), expõe metadata.
**Risco:** Baixo em Vercel (sem IMDS); maior em deploys self-hosted/AWS.
**Correção:** Em `src/config.ts`, validar com `z.string().url().refine(u => /^https:\/\//.test(u))` + blocklist de hostnames privados.

## Recomendações priorizadas pra chegar a 10

1. **[esforço: M]** Adotar `zod` em TODAS as rotas `app/api/**`. Criar `lib-web/validators.ts` com schemas por rota e usar `Schema.parse(body)` em vez de `as Body`. Mata o problema #1 (input validation) e mitiga mass-assignment em `atualizarEmpresa`/`patchPost`.
2. **[esforço: M]** Implementar rate-limit com `@upstash/ratelimit` + Vercel KV (ou Upstash Redis). Aplicar via wrapper `withRateLimit(req, { kind: 'upload' })`. Limites diferentes por rota.
3. **[esforço: P]** Adicionar `async headers()` em `next.config.ts` com HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy. CSP em report-only depois.
4. **[esforço: P]** Quota de upload: rejeitar `tamanhoBytes > 6_000_000_000` em `/api/upload/url`, e trocar `getSignedUrl(PutObjectCommand)` por `createPresignedPost` com `content-length-range` no policy.
5. **[esforço: P]** `npm audit fix` (sem `--force`) + bump manual de `next` em staging. Validar build, testar Clerk + R2 upload + Notion OAuth.
6. **[esforço: P]** Wrapper de error response: nunca devolver `err.message` raw em 5xx. Logar com `traceId` e devolver `{ error: 'erro interno', traceId }`.
7. **[esforço: P]** Fixar cookie `empresa_slug` como `httpOnly: true` no endpoint `/api/convites-onboarding/[token]/consumir/route.ts:53`. Migrar EmpresaSelector pra ler via Server Component prop ou GET `/api/me/empresa-ativa`.
8. **[esforço: P]** Validar `ZERNIO_REDIRECT_BASE_URL` no `src/config.ts` (sem fallback hardcoded de domínio Vercel).
9. **[esforço: P]** Endpoint público `/api/convites-onboarding/[token]` deve retornar resposta neutra (não diferenciar 404 vs 410). Adicionar rate-limit por IP.
10. **[esforço: M]** Auditoria de logs: garantir que `console.error` em rotas server só loga em servidor, nunca chega no client. Estruturar log com `traceId`.
11. **[esforço: G]** Considerar key rotation pra `ENCRYPTION_KEY`: hoje perder a chave é catastrófico (comentado no `.env.example`). Implementar versionamento (`v1:` prefix no ciphertext) e suporte a duas chaves simultâneas durante rotação.
12. **[esforço: G]** Considerar mover `tenant_secrets` pra AWS Secrets Manager / Vercel Edge Config / GCP Secret Manager — banco cifrado por chave compartilhada é OK pra escala atual, mas KMS gerencia rotação e auditoria melhor.
13. **[esforço: M]** Audit log no DB: `audit_log` table com `userId`, `acao`, `empresaId`, `ts`, `ip`, `userAgent`. Crítico pra rastrear quem trocou chave Zernio/Notion ou aprovou post.
