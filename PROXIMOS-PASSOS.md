# Próximos Passos — Swell Mermaid

> Plano de subida pra 10/10 derivado da auditoria de 2026-06-30.
> Relatório completo: [audit/00-RELATORIO-FINAL.md](./audit/00-RELATORIO-FINAL.md)
> Régua atual (média): **5,23 / 10**

---

## Onda 1 — "Não envergonhar na rodada de testes humanos"

**Meta:** sair daqui com média **~6,5/10**. Tampar o que compromete teste com humano externo.
**Esforço total estimado:** ~30h.

### Segurança & Multi-tenancy (M, 8h)
- [ ] `lib-web/validators.ts` com schemas Zod por rota, aplicar em todas as `/api/*`
- [ ] Guard `assertPagePertenceAoTenant` em `lib-web/notionData.ts` (carregamento + PATCH) — fecha IDOR em `/api/posts/[pageId]`
- [ ] `npm audit fix` (1 high + 6 moderate)
- [ ] Security headers em `next.config.ts` (CSP / HSTS / X-Frame-Options / Referrer-Policy)
- [ ] Cap de tamanho no presigned upload via `createPresignedPost` com `content-length-range`

### Confiabilidade (M, 6h)
- [ ] `src/lib/resiliencia.ts` com helper `comTimeoutERetry(fn, opts)` (3 retries, 30s timeout, exponential backoff)
- [ ] Aplicar em Anthropic / Zernio / Notion
- [ ] ffmpeg com `timeout: 120_000` em `execFile`
- [ ] Marcar `Status=Publicando` no Notion **antes** de chamar Zernio (mata a race de duplicação)

### Observabilidade mínima (P, 3h)
- [ ] Sentry no Next (Vercel) + no worker (Railway)
- [ ] `/api/health` endpoint + `railway.json` `healthcheckPath`
- [ ] Healthchecks.io ping no fim de cada cron

### Testes mínimos (P, 3h)
- [ ] `.github/workflows/ci.yml` rodando typecheck + build em PR
- [ ] Branch protection no main
- [ ] Vitest + 5 unit tests (`reconciliarCopy`, roteamento de redes, parser de nome, `scheduledFor` passado→publishNow, filtro de tamanho)

### Docs essenciais (P, 4h)
- [ ] Tirar `COMO-FUNCIONA.md` do `.gitignore`
- [ ] `README.md` mínimo na raiz (o que é + quickstart + links pros SETUP-F2)
- [ ] `RUNBOOK.md` (rollback Vercel/Railway, backup `ENCRYPTION_KEY`, debugar cron manual)
- [ ] `docs/USUARIO.md` pra Swell/Isa (upload, aprovar, editar copy, FAQ)

### Legal (P, 2h)
- [ ] Termos de uso + Política de privacidade (template ou Iubenda)
- [ ] Checkbox de aceite no signup

### UX mínimo (M, 4h)
- [ ] Sidebar com hamburger + drawer em mobile
- [ ] Remover tema claro do onboarding (`from-white to-amber-50/40`)
- [ ] Remover `bg-cream/50` e `hover:text-app` do drawer
- [ ] Reskinar `StatusBadge` (`bg-blue-100` etc) pro tema dark
- [ ] Botões Aprovar / Rejeitar do drawer com tokens do DS

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
