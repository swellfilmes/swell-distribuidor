# Próximos Passos — Swell Mermaid

> Plano de subida pra 10/10 derivado da auditoria de 2026-06-30.
> Relatório completo: [audit/00-RELATORIO-FINAL.md](./audit/00-RELATORIO-FINAL.md)
> Régua atual (média): **5,23 / 10**

---

## Onda 1 — "Não envergonhar na rodada de testes humanos" ✅ CONCLUÍDA (2026-06-30)

**Meta:** sair daqui com média **~6,5/10**. Tampar o que compromete teste com humano externo.
**Esforço total estimado:** ~30h.
**Resultado:** todos os itens entregues nos commits `955652f` e `38fd22d`. Build limpo, typecheck limpo, `npm test` 33/33.

### Segurança & Multi-tenancy (M, 8h)
- [x] `lib-web/validators.ts` com schemas Zod por rota, aplicado em 11 rotas `/api/*` (.strict() em todos)
- [x] Guard `assertPagePertenceAoTenant` em `lib-web/notionData.ts` (carregamento + PATCH) — IDOR fechado
- [x] `npm audit fix` (form-data CRLF removido; sobram 2 moderate em postcss transitivo do Next 16, sem fix sem downgrade)
- [x] Security headers em `next.config.ts` (HSTS / X-Frame-Options / Referrer-Policy / Permissions-Policy / X-Content-Type-Options). CSP ficou pra Onda 2 — exige teste fino com Clerk/Sentry.
- [x] Cap de tamanho no presigned upload — `tamanhoBytes` obrigatório, assinado com `ContentLength`; cap 5GB em `LIMITE_UPLOAD_BYTES`

### Confiabilidade (M, 6h)
- [x] `src/lib/resiliencia.ts` com `comTimeoutERetry(fn, opts)` (timeout + exponential backoff em ECONNRESET/5xx/429)
- [x] Aplicado em Anthropic (cerebro, redator, avaliador, thumbnailAgent, agendador) e Zernio (createPost, getPost)
- [x] ffmpeg/ffprobe com timeout (5min ffmpeg, 30s ffprobe)
- [x] Anti-race: `ZernioPostId='PROCESSING-<ts>'` antes de chamar Zernio, libera em caso de exceção

### Observabilidade mínima (P, 3h)
- [x] `@sentry/nextjs` v10 wireado (server + edge + client + worker). No-op silencioso sem DSN.
- [x] `/api/health` endpoint
- [x] `src/lib/healthcheck.ts` + integração em `paraCadaEmpresa` (ping start/success/fail por cron via `HEALTHCHECKS_<NOME>_URL`)

### Testes mínimos (P, 3h)
- [x] `.github/workflows/ci.yml` com `npm ci + typecheck + build + test` em PR e push main
- [ ] Branch protection no main (configurar via UI do GitHub — passo manual)
- [x] Vitest + 33 testes em 5 arquivos (`reconciliarCopy`, `parseNome`, `limitesRede`, `resiliencia`, `publicacaoAgora`)

### Docs essenciais (P, 4h)
- [x] `COMO-FUNCIONA.md` removido do `.gitignore` (agora versionado)
- [x] `README.md` na raiz (72 linhas)
- [x] `RUNBOOK.md` na raiz (256 linhas — deploy, rollback, backup ENCRYPTION_KEY, debug cron, Notion DB, Zernio Profile)
- [x] `docs/USUARIO.md` (176 linhas — onboarding, upload, aprovação, FAQ)

### Legal (P, 2h)
- [x] `app/termos/page.tsx` (~250 linhas, v1 2026-06-30)
- [x] `app/privacidade/page.tsx` (~300 linhas, LGPD-compliant)
- [x] Coluna `users.termosAceitos` no schema + `AceiteTermosGate` bloqueando `/app/*` e `/convite/[token]` até aceitar + `POST /api/aceitar-termos`

### UX mínimo (M, 4h)
- [x] Sidebar com hamburger fixo top-left + drawer mobile + overlay + ESC pra fechar
- [x] Onboarding com gradient dark (`from-app via-app to-surface`)
- [x] PostDetailDrawer: `bg-cream/50` → `bg-surface/60`; `hover:text-app` → `hover:text-fg`; `bg-primary/40` → `bg-app/70`
- [x] StatusBadge e RedeBadge reskinados pro tema dark (tokens `/15 /30` em vez de `bg-blue-100`)
- [x] Botões Aprovar (primary/app) e Rejeitar (error/40) dentro do DS

---

## Onda 2 — "Subir pra produto sério"

**Meta:** média **~8/10** em todos os pilares.
**Esforço:** ~60h (2-3 semanas).

### Design System de verdade (G, 16h)
- `components/ui/` com Button, Input, Card, Modal, Drawer, ConfirmDialog, Badge, Skeleton
- Refatorar telas existentes pra usar os componentes (colapsa ~2000 linhas duplicadas)
- WCAG AA: revisar opacidades (`bg-primary/8`, `text-fg-muted/40` reprovam)
- Empty states com CTA em Posts
- Confirmações destrutivas com ConfirmDialog em vez de `window.confirm()`

### Testes de integração (G, 12h)
- Vitest com mocks de Notion/Zernio/Claude
- Cobertura mínima 60% em `src/publish/`, `src/brain/`, `lib-web/`
- Playwright pra fluxo principal (upload → aprovar → publicar)

### Observabilidade completa (M, 6h)
- Logs estruturados (pino) com agregador (Better Stack ou Axiom)
- Audit log no DB (quem aprovou, quem editou copy, quem rejeitou)
- Métricas por tenant (posts/mês, taxa de sucesso por rede)

### Performance (M, 8h)
- Prompt caching Claude (4 system prompts — ~80% do OPEX evitável)
- Paralelizar crons (Promise.all com pool 3-5 por tenant)
- Multipart upload pra >100MB no R2
- Paginação real em /app/posts

### Arquitetura (M, 6h)
- `src/lib/notionRead.ts` consolidando os 7 helpers duplicados em 10 arquivos
- Boundary Zernio (interface), removendo duplicações em maintenance
- Invalidar singleton Zernio em `invalidarCache`

### Docs completas (M, 8h)
- Diagrama C4 mermaid (L1 contexto, L2 containers, ERD do DB)
- Setup completo pra novo dev
- Changelog automático
- FAQ pro usuário final

### Produto (M, 4h)
- Workshop ICP (4h presencial — não código)
- Tabela de planos publicada (Starter R$197 / Studio R$497 / Agency R$1.197)
- Endpoint `DELETE /api/empresas/[id]/dados` (LGPD)

---

## Onda 3 — "Pronto pra cobrar e crescer"

**Meta:** **9-10/10** em todos os pilares + viabilidade comercial.
**Esforço:** ~80h (3-4 semanas).

### Monetização (G, 24h)
- Integração Stripe (assinatura mensal/anual)
- Quotas por plano (vídeos/mês, redes conectadas, retenção R2, usuários)
- Trial 14 dias
- Landing comercial em `app/page.tsx`
- Dashboard de billing

### Multi-stakeholder (G, 20h)
- Persona "cliente-do-cliente" (Swell publica na conta da Austral, Austral aprova)
- Aprovação por link mágico (sem signup)
- Escopo por workspace

### Analytics pós-publicação (G, 16h)
- Webhooks Zernio (impressões, likes, salvamentos)
- Dashboard de performance por rede/cliente/tipo
- Feedback loop com redator (Claude aprende com o que performou)

### Resiliência distribuída (M, 8h)
- Heartbeat/lease em jobs (`lockedUntil` column)
- Múltiplos workers no Railway com claim atômico

### Scale (M, 12h)
- Connection pool Neon configurado
- Cache de tenant config com TTL
- CDN das thumbnails
- Background regeneration de thumbnails

---

## Como usar este arquivo

1. Marcar `[x]` à medida que cada item entrega.
2. Ao fim de cada onda, reavaliar a régua e decidir se segue pra próxima ou volta a feature work.
3. Não pular onda — cada uma habilita a próxima.
