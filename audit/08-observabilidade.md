# Auditoria — Pilar 08: OBSERVABILIDADE & OPERAÇÕES

**Data:** 2026-06-30
**Auditor:** Claude (Opus 4.7)
**Escopo:** logs, captura de erros, métricas, alertas, rastreio de jobs, healthcheck, runbooks, audit log, propagação de erro pro usuário.

---

## NOTA: **3 / 10**

### Justificativa em 1 parágrafo

O projeto roda em produção (Vercel + Railway + Neon) com **zero ferramentas de observability instaladas** — sem Sentry, Highlight, Logflare, Datadog, Axiom, pino, winston ou similar (verificado em `package.json`). Toda telemetria é `console.log` cru (66 ocorrências em `src/` e `worker/`: 41 `log`, 21 `error`, 3 `warn`, 1 `console.neon` que é typo) que vai pro stdout do Railway, expira no retention do plano (~7 dias no Hobby) e some no próximo restart. Não existe healthcheck endpoint algum (`/api/health` não existe). Não existe alerta de cron falhando, job travado, ou Zernio devolvendo erro. Não existe audit log de "quem aprovou / quem mudou copy" — isso vive parcialmente no Notion mas não é replicado/consultado no app. O ÚNICO ponto forte real é a `tabela jobs` em Postgres (`src/db/schema.ts:98`), que persiste status/erro/tentativas dos ingests com índice e dedupe — é praticamente a única superfície de observability que sobrevive a restart. Pra um SaaS multi-tenant que publica conteúdo pago de cliente, o nível atual é "deu ruim, abre Railway logs e reza".

---

## Pontos fortes (o que existe e funciona)

1. **Tabela `jobs` é uma fila estruturada e persistente** (`src/db/schema.ts:98-120`). Tem `status` (`pending`/`in_progress`/`done`/`failed`), `erro` (stack/message), `tentativas`, `criadoEm`/`iniciadoEm`/`finalizadoEm`. Sobrevive a restart do Railway. Índice em `(status, criadoEm)` permite drill-down rápido.
2. **Logs por job têm contexto bom** (`worker/index.ts:25-29`): timestamp + jobId + etapa + mensagem. Formato: `[hora] [worker #123] [etapa] msg`. Não é JSON, mas é grep-friendly.
3. **Logs do ingest são acumulados em `jobs.result.logs`** (`worker/index.ts:67-82`): o array de strings de cada etapa fica salvo no Postgres junto com o resultado — isto é o salvador da pátria pra debug post-mortem de uploads. Logs de cron NÃO têm esse tratamento.
4. **Isolamento de erro por empresa nos crons** (`worker/crons/comum.ts:27-39`): uma empresa que quebra não derruba o ciclo de outras. Erro é logado com `[cron:slug]` tag e seguimos.
5. **Worker recupera jobs órfãos no boot** (`worker/index.ts:200-208`): jobs `in_progress` que ficaram travados num crash anterior voltam pra `pending`. Boa higiene de fila.
6. **Retry com backoff implícito**: jobs falhados voltam pra pending até `MAX_TENTATIVAS=3` (`worker/index.ts:90-101`), só viram `failed` após esgotar. Tentativas ficam visíveis no campo.
7. **Crons usam `protect: true` do croner** (`worker/index.ts:167,176,185`): impede execuções sobrepostas, pelo menos não há corrida do mesmo cron consigo mesmo.
8. **Runbook de deploy existe** (`DEPLOY-RAILWAY.md`, 104 linhas) e há `SETUP-F2-*.md` (4 docs) cobrindo fases. Não é runbook operacional ("o que fazer quando X quebra"), mas é setup.
9. **Erros em API routes têm distinção 503 vs 500** (`app/api/jobs/route.ts:55-60`): rate limit do Neon devolve 503 (transitório) vs erro real 500 — UX melhor pro cliente decidir retry.

---

## Problemas críticos

### CRÍTICO

1. **Zero captura de erros estruturada.** `package.json` não tem Sentry, Highlight, Logflare, Axiom, pino, winston, datadog, nada. Toda exceção em produção é `console.error` (21 ocorrências) que vai pro stdout do Railway e some. Não há agregação, dedupe, alerta, breadcrumb, source-map de erro do Next no Vercel — nada. Para um SaaS com clientes pagos, isto é a primeira coisa a corrigir.
2. **Sem healthcheck endpoint algum.** Busca por `health` / `/api/health` retorna vazio. `railway.json` tem `restartPolicyType: ON_FAILURE` mas não há check pro Railway saber se o worker está vivo respondendo — só sabe se o processo morreu. Worker pode estar travado num loop e Railway nem percebe. Sem `/api/health` no Next também — Vercel não tem como pingar.
3. **Logs do Railway são efêmeros e únicos.** Plano Hobby tem retention curto (~7 dias). Restart limpa contexto. Não há replicação pra Logflare/Axiom/S3. Pergunta "o que aconteceu com a linha X do Notion há 2 semanas?" é **inrespondível** se não foi um job de ingest (que tem logs salvos no DB).
4. **Crons rodam totalmente silenciosos do ponto de vista do usuário.** Cron de publicar (a cada 5min) pode estar publicando, falhando silenciosamente ou nem rodando — usuário só descobre quando abre o Notion e vê que "Aprovado" não virou "Publicado". Nenhum alerta, nenhuma métrica, nenhum dashboard. `worker/crons/comum.ts:38` engole erros com `console.error` e segue.
5. **Sem alerta de cron travado / quebrado.** Se o worker morrer ou um cron crashar 10x seguidas com a mesma empresa, ninguém sabe. Não há dead man's switch (cronitor, healthchecks.io), não há Slack/email webhook. Cliente vai reclamar primeiro.
6. **Sem audit log de quem aprovou / mudou copy.** A aprovação acontece no Notion (humano marca status), mas o app NÃO replica "user X aprovou pageId Y em timestamp Z". Investigação de "quem autorizou esta publicação ofensiva" depende 100% do histórico do Notion (que tem versionamento limitado e some quando a empresa é deletada). Para conteúdo de cliente pago, isto é risco jurídico real.
7. **`console.neon` no código** — `grep "console\."` revela uma chamada `console.neon` (typo de algum `console.error` autocompletado errado ou similar). Vai dar runtime error se executado. Demonstra que ninguém leu os logs como esquema.

### MÉDIO

8. **Logs não são JSON estruturados.** Formato é livre (`[hora] [tag] [etapa] msg`). Não dá pra filtrar/queryear/agregar facilmente. Sem `traceId`, sem `empresaId` consistente em todos os logs, sem `userId` em logs de API.
9. **Erros do Zernio são salvos no Notion mas não propagam pro usuário do app.** `src/maintenance/publicarAprovados.ts:189-191` registra `❌ {rede}: {erro}` no log do cron e em `registrarResultado`, mas o usuário no painel Next só vai ver isso se abrir o Notion. Não há tela de "minhas publicações que falharam" no app web.
10. **Polling do upload é só por job individual** (`app/api/jobs/[id]/route.ts`). Não há listagem agregada `/api/jobs?status=failed` pra admin ver "todos meus uploads quebrados nos últimos 7 dias". `app/api/upload/url/route.ts:50-72` lista pra dedupe, mas é por chave de arquivo, não exposto como dashboard.
11. **Nenhuma métrica de uso.** Não há contagem de "quantos posts publicados por mês", "tempo médio ingest→aprovação", "% de jobs que falham", "latência por integração (Anthropic, Zernio, Notion, R2)". Pra precificar plano ou diagnosticar regressão de produto, hoje é cego.
12. **`MAX_TENTATIVAS=3` é silencioso após falha permanente.** Quando esgota retries (`worker/index.ts:103-113`), job vira `failed` no DB mas ninguém é notificado. Cliente fez upload, viu spinner, o card vira "erro" no front (talvez), e nada chega pra equipe Swell.
13. **Sem rastreamento distribuído.** Worker faz coisas no Notion, Zernio, R2, Anthropic — sem `traceId` que conecte "este job → estas N chamadas externas → estes N logs". Debugar "por que ingestjob #847 demorou 4 min" é arqueologia manual.
14. **Sem timeout configurado em chamadas externas.** Não vi `signal: AbortSignal.timeout(...)` em fetches Anthropic/Zernio/Notion. Worker pode pendurar minutos esperando resposta morta antes do timeout default do node.
15. **Runbooks são só de setup**, não de operação. `DEPLOY-RAILWAY.md` é "como subir pela primeira vez", não "como diagnosticar cron parado", "como reprocessar fila travada", "como rotar segredo do Zernio sem downtime".

### BAIXO

16. **`console.log` no path crítico de produção** (`src/publish/zernio.ts:349-357`) — código de "listar contas" usa `console.log` direto, deveria ser callback `onLog` como o resto. Inconsistência.
17. **`process.exit(1)` no crash do worker** (`worker/index.ts:215`) — ok, mas combinado com Railway restart policy pode causar loop de boot caro se erro for determinístico (ex: secret inválido).
18. **Erros do `app/error.tsx`** (`app/app/error.tsx:13`) só fazem `console.error` — Next 16 tem hook pra mandar pro Sentry, mas como Sentry não existe, é só ruído.

---

## Recomendações priorizadas

### P0 — fazer esta semana

1. **Plugar Sentry no Next + worker** (~2h, R$0 free tier até 5k errors/mês). Captura exceções não tratadas, envia stacktrace + breadcrumbs. Configurar `tracesSampleRate: 0.1` pra ter uma amostra de performance. Adicionar `@sentry/nextjs` (Vercel auto-inject) e `@sentry/node` no worker. Mata 80% da cegueira atual.
2. **Criar `/api/health` no Next + `/health` HTTP no worker** (~1h). Worker precisa subir um mini http server (`http.createServer`) só pra Railway pingar. Configurar `healthcheckPath` no `railway.json`. Sem isso, restart policy é cega.
3. **Dead man's switch nos crons** (~30min). Healthchecks.io free, 1 ping HTTP no fim de cada execução de cron. Se cron não pingar em 1h, eles te emailam. Adicionar 3 endpoints (um por cron) e um `fetch` no fim do try.

### P1 — próximas 2 semanas

4. **Logger estruturado JSON** (`pino` é trivial, ~3h migração). Substituir `console.log` por `logger.info({ jobId, empresaId, etapa }, msg)`. Habilita query no Logflare/Axiom/Better Stack (R$0-50/mês).
5. **Espelhar logs num storage durável**. Logflare (free 12.5M events/mês) ou Better Stack. Plugar via pino transport. Resolve o "logs somem com restart".
6. **Audit log no Postgres** (~2h). Tabela `auditoria` com `userId`, `empresaId`, `acao` (`aprovou`/`rejeitou`/`editou_copy`/`agendou`), `recursoId` (notion pageId), `timestamp`, `meta` jsonb. Disparar em todos os endpoints que mexem com Notion. Resolve risco jurídico.
7. **Página `/posts/falhas` no app** mostrando jobs `failed` + linhas Notion com erro de Zernio. UX: usuário não precisa abrir Notion pra ver quebrou.

### P2 — próximo mês

8. **Métricas básicas com Prometheus-style counters** ou só uma tabela `metricas_diarias` agregada (`empresaId`, `data`, `posts_publicados`, `posts_falhados`, `jobs_processados`, `latencia_p50_zernio_ms`). Dashboard simples no Next.
9. **Timeout explícito em todas as chamadas externas** (`AbortSignal.timeout(30_000)` em fetches Anthropic/Zernio/Notion). Evita worker pendurado.
10. **Runbook operacional `OPS.md`**: "cron parou, e agora?", "como reprocessar job failed?", "como ver o que aconteceu com a linha X?", "como rotar `ZERNIO_API_KEY`?".
11. **TraceId propagado**: gerar `crypto.randomUUID()` no início de cada job/cron-ciclo e propagar via context (`AsyncLocalStorage`) pra todos os logs daquela execução. Sem isso, logs concorrentes ficam intercalados sem como separar.
12. **Notificação Slack/email em falhas críticas**: webhook simples no `catch` do worker.ts e no fim do cron quando `failed > N`. R$0, ~1h.

---

## Arquivos relevantes citados

- `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/package.json` — confirma zero deps de observability
- `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/worker/index.ts` — loop de jobs + crons + logs ad-hoc
- `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/worker/crons/comum.ts` — isolamento + log por empresa
- `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/worker/handlers/ingest.ts` — handler de job acumula logs em array
- `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/src/db/schema.ts` (l.98-120) — tabela jobs (única observability persistente)
- `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/src/maintenance/publicarAprovados.ts` — erros Zernio só logados via callback
- `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/src/publish/zernio.ts` (l.349-357) — `console.log` direto fora de callback
- `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/app/api/jobs/route.ts` — único endpoint que diferencia 503 vs 500
- `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/app/api/jobs/[id]/route.ts` — polling por job individual, sem listagem agregada
- `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/app/app/error.tsx` — `console.error` no boundary (sem Sentry)
- `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/railway.json` — sem `healthcheckPath`
- `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/DEPLOY-RAILWAY.md` — runbook só de setup, não de operação
