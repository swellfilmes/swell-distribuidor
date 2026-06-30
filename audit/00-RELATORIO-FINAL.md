# Swell Mermaid — Relatório Consolidado de Auditoria

**Data:** 2026-06-30
**Método:** 11 agentes Opus em paralelo, cada um especializado em um pilar. Cada agente leu o código, rodou checagens (typecheck, npm audit, busca por padrões) e produziu relatório detalhado em `audit/0X-pilar.md`.

---

## Foto da Régua

| # | Pilar | Nota | Status |
|---|---|---|---|
| 01 | Segurança & Secrets | **6,5** | Base boa, gaps de validação |
| 02 | Multi-tenancy & Isolamento | **7,0** | Forte, com 1 IDOR aberto |
| 03 | Arquitetura & Código | **7,5** | Melhor pilar |
| 04 | Confiabilidade & Resiliência | **6,5** | Sem retry/timeout em externos |
| 05 | UX & Design System | **5,5** | Mobile quebrado + tema claro vazando |
| 06 | Onboarding & Fluxo | **7,0** | Caminho-feliz bom |
| 07 | Performance & Escalabilidade | **6,5** | OK pra 1-3 tenants, não pra 10+ |
| 08 | Observabilidade | **3,0** | Voa às cegas |
| 09 | Testes & QA | **0,5** | Inexistente |
| 10 | Documentação & DX | **4,5** | README ausente, `COMO-FUNCIONA.md` no .gitignore |
| 11 | Produto & Negócio | **3,0** | Sem monetização, sem ICP, risco LGPD |

**Média:** **5,23 / 10**

**Leitura:** A engenharia núcleo (arquitetura, multi-tenancy, segurança) está acima de 6. O que puxa a nota pra baixo é tudo que cerca um SaaS de verdade: testes, observabilidade, docs e modelo de negócio. Em termos práticos: o código publica vídeo bem, mas se algo quebrar em produção você não fica sabendo, não tem teste pra impedir regressão e nem documentação pra outro dev entrar.

---

## Temas Transversais (problemas que aparecem em vários pilares)

### TEMA A — "Voar às cegas" (aparece em 08, 04, 09)
Nada de logs estruturados, sem Sentry, sem healthcheck, sem alerta. Falha do cron → ninguém sabe. Bug em produção → não tem como reproduzir. Combina mal com zero testes.

### TEMA B — Falta de validação de input (aparece em 01, 03)
Todas as rotas `/api/*` usam `(await req.json()) as Body` sem zod. Risco de segurança real + acoplamento ruim. **Zod já está nas dependências** — falta usar.

### TEMA C — Identidade visual quebrada em produção (aparece em 05, 06)
Tema dark vazando pra claro em telas-chave (onboarding, drawer, badges com `bg-blue-100` no fundo `#08131F`). Botões críticos (Aprovar/Rejeitar) fora do design system. Confirmações com `window.confirm()` nativo. Mata o posicionamento "premium" do produto.

### TEMA D — Sem rede de proteção pra crescer (aparece em 09, 08, 10)
Sem CI, sem staging, sem teste, sem doc de rollback. Cada push pro `main` é deploy direto em produção. Erros pós-deploy recentes (RAILPACK→NIXPACKS, OOM, ffmpeg serial) confirmam o padrão.

### TEMA E — Produto sem cobrança ainda (aparece em 11)
Zero menção a Stripe/billing. Sem ICP definido, sem termos de uso, sem política de privacidade, sem endpoint LGPD. Aceitável pra teste interno; bloqueia o segundo cliente real.

---

## Top 15 Achados Críticos (ordenados por risco)

### Bloqueadores antes da rodada de testes com humanos

1. **[Multi-tenancy]** IDOR em `app/api/posts/[pageId]/route.ts:24-57` — não valida que a página Notion pertence ao tenant. Risco: vazamento cross-tenant se OAuth Notion tocar 2 workspaces.
2. **[Segurança]** Zero validação Zod em ~20 rotas `/api/*`. Mass-assignment em `lib-web/adminEmpresas.ts:167`. Sem cap de tamanho em PATCH.
3. **[Segurança]** Presigned upload sem cap de tamanho (`src/storage/r2.ts:54-75`). Qualquer membro sobe TBs ao R2.
4. **[Confiabilidade]** Race que duplica posts no Zernio (`src/maintenance/publicarAprovados.ts:172-217`) se Zernio aceitar mas Notion falhar gravando `ZernioPostId`.
5. **[Confiabilidade]** Zero timeout/retry em chamadas externas (Anthropic, Zernio, Notion, ffmpeg). 1x flaky kill o trabalho.
6. **[Produto/Legal]** Sem termos de uso + política de privacidade. Risco LGPD direto assim que entrar o 2º cliente B2B.

### Bloqueadores antes do segundo cliente real

7. **[UX]** App inutilizável em mobile (`components/Sidebar.tsx:37` — `hidden md:flex` sem hamburger).
8. **[UX]** Tema claro vazando no dark — onboarding gradient white→amber, badges `bg-blue-100`, botão crítico `bg-blue-600`.
9. **[Observabilidade]** Sem Sentry, sem healthcheck, sem dead-man's switch nos crons.
10. **[Testes]** Zero CI/CD. Push pro main → deploy direto. Zero testes automatizados.
11. **[Docs]** Sem README. `COMO-FUNCIONA.md` no `.gitignore` por engano. Sem runbook de rollback.

### Importantes pra escalar

12. **[Performance]** Sem prompt caching no Claude (`src/brain/cerebro.ts`, `redator.ts`, `avaliador.ts`, `thumbnailAgent.ts`) — ~80% do custo Anthropic evitável.
13. **[Performance]** Crons sequenciais por tenant. Com 10 tenants × 50 pendentes o cron de 5min não fecha antes do próximo tick.
14. **[Multi-tenancy]** Singleton Zernio nunca invalidado (`src/lib/clients.ts:11,71,77`) — rotação de key não tem efeito até restart.
15. **[Arquitetura]** DRY grave: 7 helpers de leitura Notion (`lerRichText`, `lerTitle` etc) copiados em 10 arquivos.

---

## Plano de Subida pra 10/10

Cada fase entrega um produto qualitativamente diferente. Não pular fase.

### Onda 1 — "Não envergonhar na rodada de testes" (1 semana, ~30h)

Foco: tampar buracos que comprometem teste com humano externo. Sai daqui com média **6,5/10**.

**Segurança & Multi-tenancy (M, 8h)**
- Criar `lib-web/validators.ts` com schemas Zod por rota, aplicar em todas as `/api/*`.
- Guard `assertPagePertenceAoTenant` em `lib-web/notionData.ts` carregamento e PATCH.
- `npm audit fix` + headers de segurança em `next.config.ts` (CSP/HSTS/X-Frame-Options).
- Cap de tamanho no presigned upload via `createPresignedPost` com `content-length-range`.

**Confiabilidade (M, 6h)**
- Helper `comTimeoutERetry(fn, opts)` em `src/lib/resiliencia.ts`, aplicar em Anthropic/Zernio/Notion (3 retries, 30s timeout, exponential backoff).
- ffmpeg com `timeout: 120_000` em `execFile`.
- Marcar `Status=Publicando` no Notion **antes** de chamar Zernio (mata a race).

**Observabilidade mínima (P, 3h)**
- Sentry no Next + no worker.
- `/api/health` endpoint + `railway.json` `healthcheckPath`.
- Healthchecks.io ping no fim de cada cron.

**Testes mínimos (P, 3h)**
- `.github/workflows/ci.yml` rodando typecheck + build em PR. Branch protection no main.
- Vitest + 5 unit tests dos pontos mais frágeis (`reconciliarCopy`, regras de roteamento, parser de nome de arquivo, `scheduledFor` passado→publishNow).

**Docs essenciais (P, 4h)**
- Tirar `COMO-FUNCIONA.md` do `.gitignore`.
- `README.md` mínimo na raiz (o que é + quickstart).
- `RUNBOOK.md` (rollback Vercel/Railway, backup `ENCRYPTION_KEY`, como debugar cron).
- `docs/USUARIO.md` pra Swell/Isa.

**Legal (P, 2h)**
- Termos de uso + Política de privacidade (Iubenda ou template).
- Checkbox de aceite no signup.

**UX mínimo (M, 4h)**
- Sidebar com hamburger em mobile.
- Remover tema claro do onboarding e drawer.
- Reskinar badges/botões críticos pro tema dark.

### Onda 2 — "Subir pra produto sério" (2-3 semanas, ~60h)

Foco: subir nota pra **8/10** em todos os pilares.

**Design System de verdade (G, 16h)**
- `components/ui/` com Button, Input, Card, Modal, Drawer, ConfirmDialog, Badge, Skeleton.
- Refatorar telas existentes pra usar os componentes (colapsa ~2000 linhas duplicadas).
- WCAG AA: revisar opacidades `bg-primary/8`, `text-fg-muted/40`.
- Empty states com CTA em Posts.

**Testes de integração (G, 12h)**
- Vitest com mocks de Notion/Zernio/Claude.
- Cobertura mínima 60% em `src/publish/`, `src/brain/`, `lib-web/`.
- Playwright pra fluxo principal (upload → aprovar → publicar).

**Observabilidade completa (M, 6h)**
- Logs estruturados (pino) com agregador (Better Stack ou Axiom free tier).
- Audit log no DB (quem aprovou, quem editou copy, quem rejeitou).
- Métricas por tenant (posts/mês, taxa de sucesso por rede).

**Performance (M, 8h)**
- Prompt caching Claude (4 system prompts).
- Paralelizar crons (Promise.all com pool 3-5 por tenant).
- Multipart upload pra >100MB no R2.
- Paginação real em /app/posts.

**Arquitetura (M, 6h)**
- `src/lib/notionRead.ts` consolidando os 7 helpers duplicados.
- Boundary Zernio (interface), removendo duplicações em maintenance.
- Invalidar singleton Zernio em `invalidarCache`.

**Docs completas (M, 8h)**
- Diagrama C4 mermaid (L1 contexto, L2 containers, ERD).
- Setup completo pra novo dev.
- Changelog automático.
- FAQ pro usuário final.

**Produto (M, 4h)**
- Workshop ICP (4h presencial — não código).
- Tabela de planos publicada (Starter / Studio / Agency).
- Endpoint `DELETE /api/empresas/[id]/dados` (LGPD).

### Onda 3 — "Pronto pra cobrar e crescer" (3-4 semanas, ~80h)

Foco: viabilidade comercial + scale. Sai daqui rumo a **9-10/10**.

**Monetização (G, 24h)**
- Integração Stripe (assinatura mensal/anual).
- Quotas por plano (vídeos/mês, redes conectadas, retenção R2, usuários).
- Trial 14 dias.
- Landing comercial em `app/page.tsx`.
- Dashboard de billing.

**Multi-stakeholder (G, 20h)**
- Modelar persona "cliente-do-cliente" (Swell publica na conta da Austral).
- Aprovação por link mágico (sem signup).
- Escopo por workspace.

**Analytics pós-publicação (G, 16h)**
- Integrar webhooks Zernio (impressões, likes, salvamentos).
- Dashboard de performance por rede/cliente/tipo.
- Feedback loop com redator (Claude aprende com o que performou).

**Resilência distribuída (M, 8h)**
- Heartbeat/lease em jobs (`lockedUntil` column) pra detectar worker travado sem reset destrutivo.
- Múltiplos workers no Railway com claim atômico.

**Scale (M, 12h)**
- Connection pool Neon configurado.
- Cache de tenant config com TTL.
- CDN das thumbnails.
- Background regeneration de thumbnails.

---

## Próximos passos sugeridos

1. **Você lê este relatório e os 11 detalhados em `audit/0X-*.md`** (cada um tem evidências com path:linha).
2. **Confirma a Onda 1 como nosso próximo bloco** — eu executo tudo, abro PRs ou commits diretos como você preferir.
3. **Após Onda 1, reavaliamos a régua** pra ver se os números bateram. Se sim, decidimos se vai pra Onda 2 ou já volta a features novas.

Não vou começar a corrigir nada antes da sua confirmação. A decisão de Onda 1 → 2 → 3 é estratégica e depende de quando você quer abrir pra mais clientes, quando quer começar a cobrar, e quanto risco está disposto a aceitar na rodada de testes.
