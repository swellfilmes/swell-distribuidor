# Auditoria — Pilar CONFIABILIDADE & RESILIÊNCIA

**Data:** 2026-06-30
**Escopo:** integrações externas (Zernio, Notion, Anthropic, R2), worker no Railway, jobs queue, ffmpeg, race conditions, logging.

---

## Nota: **6.5 / 10**

Há trabalho real e cuidadoso de confiabilidade aqui — claim atômico de jobs, retry com backoff pra DB, dedup de uploads, isolamento por empresa, reconciliação Notion antes de publicar, `protect:true` nos crons, reset de jobs órfãos no boot. Mas as integrações externas que MAIS importam (Zernio, Notion, Anthropic) não têm retry/timeout próprios, várias operações multi-passo não são atômicas, e o logging some no Railway sem agregação. O sistema é "fail-soft no feliz", mas tem buracos perigosos quando o cenário não-feliz aparece.

---

## Pontos fortes

1. **Claim atômico de jobs com idempotência defensiva** (`worker/index.ts:35-59`). UPDATE com WHERE `status=pending` garante que 2 workers concorrentes nunca peguem o mesmo job, e `idsAtivos: Set<number>` adiciona dedup defensivo dentro do processo. Reset de jobs `in_progress` no boot (`worker/index.ts:200-208`) cobre crashes anteriores.
2. **Retry exponencial com classificação de erro pra DB Neon** (`src/db/retry.ts`). Distingue rate-limit (retentável, 250/500/1000ms + jitter) de erro permanente (propaga). Aplicado em rotas críticas (`app/api/jobs/route.ts`, `app/api/empresas/[id]/zernio/*`).
3. **Idempotência forte no fluxo de publicação**:
   - Cron `publicarAprovados` filtra `ZernioPostId is_empty` (`src/maintenance/publicarAprovados.ts:67`), então não republica linha já enviada ao Zernio.
   - `ingerirPasta` checa hash sha1 do path em Notion `DriveFileId` (`src/maintenance/ingerirPasta.ts:79-93`).
   - Upload web tem dedup por `(nome, tamanho, lastModified)` em janela de 1h (`app/api/upload/url/route.ts:51-87`).
4. **`protect: true` em todos os crons** (`worker/index.ts:167/176/185`) — croner ignora tick novo se anterior ainda rodando, dentro do mesmo processo.
5. **Reconciliação Notion antes de publicar** (`src/lib/reconciliarCopy.ts`). Lê estado atual do Notion (Copy + Redes) na hora de enviar pro Zernio — evita race de "humano editou enquanto eu lia".
6. **Polling do Zernio com timeout finito** (6min, `src/publish/zernio.ts:13`) e fallback "pendente" + recomendação de rodar `--atualizar-pendentes` depois. Fail-soft real.
7. **Isolamento de erro por empresa nos crons** (`worker/crons/comum.ts:27-40`): uma empresa que quebra não derruba as outras.
8. **`finally` com limpeza de arquivos tmp** em `worker/handlers/ingest.ts:200-204` e `extrairFrames.ts:75-77` — sem leak garantido de /tmp em caminhos normais.
9. **Tratamento explícito de parciais no Notion** (`src/log/notion.ts:5-20`): status `Publicado parcial`, `Pendente Zernio`, `Publicado`, `Agendado` — estado final claro pro humano.
10. **Empresa em onboarding incompleto é pulada com log discreto, não erro** (`worker/crons/comum.ts:31-34` via `integracoesCompletas`).

---

## Problemas críticos

### CRÍTICO

**C1. Anthropic / Zernio / Notion: zero retry e zero timeout configurado.**
`src/brain/cerebro.ts:152`, `src/brain/redator.ts:83`, `src/publish/zernio.ts` (toda a chamada `zernio.posts.createPost`), `src/approval/notion.ts:54-57`, `src/log/notion.ts:73-76`. Nenhuma chamada usa `AbortController`, `signal`, ou retry. Um 503 transitório do Anthropic mata o job inteiro (consome 1 das 3 tentativas e zera todo o trabalho de extrair frames + thumbnail). Um Notion `409 Conflict` (corriqueiro em edições paralelas) propaga sem retry. Um Zernio `getPost` em loop de 6min pode pendurar a chamada indefinidamente se travar TCP.

**C2. Operação multi-passo sem atomicidade no fluxo de publicação.**
`src/maintenance/publicarAprovados.ts:172-217`: a sequência é `publicarTudo` → `registrarResultado` (Notion) → `pages.update` com `dataAgendadaEmZernio`. Se o Zernio criar o post mas o Notion falhar em gravar `ZernioPostId`, na próxima passada do cron a linha continua "Aprovado + ZernioPostId vazio" e dispara **OUTRA publicação no Zernio**. Mesma linha → 2 posts agendados / publicados duplicados. Sem transação porque são sistemas diferentes, mas falta uma estratégia de "marcar lock" (status `Publicando`?) antes da chamada Zernio.

**C3. ffprobe / ffmpeg: sem timeout, sem fallback de stream.**
`worker/handlers/ingest.ts:25-40`, `src/ingest/extrairFrames.ts:14-22, 52-60`. `execFile` sem `timeout` — um ffmpeg que trava lendo R2 via range request fica pendurado. Não há retry depois de OOM kill (já houve histórico, commit `0ae1e4d`); o job só vira `failed` após 3 tentativas usando exatamente o mesmo path. Para vídeo >200MB ele decide `streamarDaUrl=true` mas se a URL falhar mid-stream não há fallback pra "baixe inteiro e tente de novo".

**C4. Logs do Railway são efêmeros e não têm agregação.**
`grep -rn "logger\|sentry\|pino"` retorna zero. Tudo é `console.log` / `console.error`. Stack traces de jobs `failed` ficam só no campo `jobs.erro` do DB (e na primeira linha do stack, `worker/index.ts:103`). Crashes do cron sequer atualizam linha alguma — só `console.error` (`worker/index.ts:171/180/189`). Sem alerting, falha silenciosa é a regra. Quando algo deu errado na semana passada, ninguém vai descobrir.

### ALTO

**C5. Race window entre humano e cron `publicar-aprovados` (a cada 5min).**
`publicarAprovados` faz `notion.databases.query` → loop → publica e só DEPOIS marca `ZernioPostId`. Se o humano marcar `Aprovado` numa linha e nesse meio tempo `query` rodar e captar, e o ciclo demorar (vídeo grande, polling Zernio até 6min) — outro ciclo do cron NÃO pode iniciar (protect:true), então OK. **MAS** se houver 2+ workers Railway (escalonamento horizontal), `protect:true` só vale dentro do processo. Não há lock distribuído.

**C6. Sem mecanismo de "lease" / heartbeat em jobs em andamento.**
Se um worker travar (não crashar — só ficar pendurado num ffmpeg sem timeout), o job fica em `in_progress` para sempre. Reset só acontece no boot do worker (`worker/index.ts:200-208`). Job nunca volta pra fila se o processo continua de pé mas o handler está travado. Faltam: `claimed_at`, `heartbeat`, ou um cron de "limpar in_progress > N min".

**C7. Reset de órfãos no boot é destrutivo demais.**
`worker/index.ts:202-205` reseta TODO `in_progress` pra `pending` sem checar se outro worker está vivo. Em ambiente com 2 workers, restartar o worker A pega jobs do worker B em andamento e zera. Solução: incluir `iniciadoEm < now() - 30min`.

**C8. R2 sem retry no upload.**
`src/storage/r2.ts:34-42` faz `s3.send(PutObjectCommand)` direto. AWS SDK v3 tem retry built-in (default 3 tentativas), mas com `Body: createReadStream(...)` e `ContentLength` fixo, em caso de retry o stream já foi consumido e retry interno do SDK falha silenciosamente. Não há reupload manual nem cleanup de upload parcial.

**C9. Polling do Notion no `aguardarDecisao` é CLI-only mas mantém recurso.**
`src/approval/notion.ts:94-115` faz polling 15s com timeout de 24h. Nunca usado pelo worker (CLI legacy), mas ainda exportado e consumível. Em uso real, gastaria quota Notion à toa. Risco baixo, fica como dívida.

**C10. Job `failed` definitivo não tem dead-letter queue nem notificação.**
`worker/index.ts:103-113`: após 3 tentativas, status vira `failed` e `erro` guarda o stack. Não há canal de notificação (email/Slack/Notion), não há re-tentativa manual fácil pelo painel. Pra usuário não-técnico (Swell), uma falha em ingest é invisível até alguém olhar o DB.

### MÉDIO

**C11. Sem `process.on('SIGTERM' / 'unhandledRejection' / 'uncaughtException')`** no worker. Quando Railway dá graceful shutdown, jobs em andamento são abortados sem chance de marcar status pendente ou liberar. Unhandled rejection mata o processo sem captura.

**C12. `MAX_CONCURRENCY = 1`** no worker (`worker/index.ts:21`) é mais limitação de RAM (Railway hobby tier) do que escolha de confiabilidade. Limita throughput severamente — fila de uploads bulk leva horas.

**C13. Atualização do `PlanoJSON` em `publicarAprovados.ts:212-217` sobrescreve o documento inteiro** sem checar `last_edited_time` do Notion. Se humano editou `Copy` durante o ciclo, vence o do servidor (parcialmente coberto por `reconciliarPlanoComNotion`, mas só lê Copy + Redes; não detecta edição de `DataPublicacao` racing).

**C14. `cancelarAgendamento` não é idempotente** (`src/maintenance/cancelarAgendamento.ts`): chamado 2x em sequência, na 2ª o `deletePost` retorna erro do Zernio mas ele continua e aplica nota "cancelado" de novo, criando histórico duplicado em `Resumo`.

**C15. Reconciliação Notion só roda na publicação, não na atualização de agendado** — espera, **roda** em `atualizarZernioAgendados.ts:152`. Mas se o humano mudar `Redes` no Notion durante o intervalo entre runs (10min), pode haver `dataMudou=false && redesEditadas=[]` na próxima passada e a mudança em Redes só se aplica na publicação real, não no Zernio update. Inconsistência temporária de estado.

**C16. Validação Zod do Claude falha = exception, job morre.**
`src/brain/cerebro.ts:175-179`, `redator.ts:106-110`. Se Sonnet 4.6 retornar JSON com chave faltando ou tipo errado, o handler explode — não há fallback "tenta de novo com temperature mais baixa" nem prompt corretivo. Em 3 tentativas o job vira failed.

**C17. `baixarDoR2` carrega tudo em memória** (`src/storage/r2.ts:96`): `Buffer.from(await Body.transformToByteArray())`. Pra vídeo 200MB no Railway hobby (RAM ~1GB), próximo do limite. Já houve OOM kill histórico — a mitigação foi serializar ffmpeg, não streamar download.

### BAIXO

**C18. `mesmaData` em `atualizarZernioAgendados.ts:11-17`** usa `Date.parse` que aceita formatos ambíguos sem timezone. Se Notion devolve `2026-07-01` e plano guardou `2026-07-01T00:00:00-03:00`, parse pode dar `false` falsamente, disparando update Zernio desnecessário.

**C19. Empresa-testador depende de Zernio compartilhado inicializado** (`src/lib/clients.ts:34-58`). `garantirZernioInicializado` é chamado em `publicarTudo` mas não em `listarContasConectadas` nem em `atualizarPendentes` → se empresa-testador rodar essas funções, vai dar throw inesperado.

---

## Recomendações priorizadas

### P0 — fazer já (1-2 dias)

1. **Adicionar `setTimeout`/`AbortController` em todas as chamadas externas**. Anthropic (`client.messages.create({ ..., signal })`), Notion (`new NotionClient({ timeoutMs })`), Zernio (envelopar com `Promise.race`), ffmpeg (`execFile({ timeout: 120_000 })`). Sem timeout = travada inteira do worker.
2. **Marcar linha como `Publicando` ANTES de chamar `publicarTudo`** em `src/maintenance/publicarAprovados.ts`. Filtro do query passa a ser `Status=Aprovado AND ZernioPostId is_empty`; ao detectar, primeiro `pages.update({Status: 'Publicando'})`, depois publicar, depois `registrarResultado`. Elimina C2 (duplicação por race).
3. **Estruturar logging** com `pino` ou nativo JSON. Cada linha precisa de `{empresaId, jobId, etapa, tenant, errMsg}`. Plugar em algo agregado (Railway logs → Better Stack / Axiom — free tier serve).
4. **Heartbeat / lease em jobs**. Adicionar coluna `lockedUntil: timestamp` no schema. Claim seta `lockedUntil = now() + 30min`, handler atualiza a cada 60s, cron `*/5 reseta in_progress where lockedUntil < now()`. Resolve C6 e parte do C7.

### P1 — próxima sprint

5. **Retry com backoff exponencial pra Anthropic/Notion/Zernio em erros transitórios** (5xx, ECONNRESET, ETIMEDOUT). Função genérica `comRetryExterno` reusando padrão de `comRetryDb` mas com regex maior (`/5\d\d|ECONN|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up/i`).
6. **Dead-letter notification**. Job `failed` definitivo → cria linha no Notion (db de admin) ou manda email pra `filmesswell@gmail.com`. Ou simplesmente um endpoint `/api/admin/jobs?status=failed` no painel.
7. **Stream download de R2** em `baixarDoR2` usando pipe direto pra arquivo (não buffer em memória). Resolve C17 e abre caminho pra MAX_CONCURRENCY > 1.
8. **`process.on('SIGTERM')`** no worker pra graceful shutdown: para de pegar jobs novos, espera ativos terminarem, atualiza `lockedUntil = null` neles.

### P2 — médio prazo

9. **Lock distribuído pros crons** (`SELECT ... FOR UPDATE SKIP LOCKED` ou Postgres advisory lock). Necessário se Railway escalar > 1 worker.
10. **Retry corretivo do Claude com prompt de fallback** quando Zod falhar: re-mandar resposta crua + erro Zod e pedir "corrige o JSON". Salva job ao invés de matar.
11. **Reupload R2 com checagem de integridade** (HEAD após PUT, ETag/SHA256).
12. **Idempotência em `cancelarAgendamento`** (C14) — checar se já tem nota "CANCELAMENTO" no Resumo antes de adicionar de novo.
13. **`mesmaData` mais robusta** — comparar epoch ms com tolerância de 60s, e não confiar em `Date.parse` puro.

---

## Resumo executivo

O design é cuidadoso onde o autor pensou nas falhas (claim atômico, dedup, isolamento por empresa, reconciliação Notion) e ingênuo onde não pensou (timeouts em integrações, logging, lease de jobs). Os 3 calos vermelhos são: **(1) zero timeout em chamadas externas**, **(2) janela de race no publicar-aprovados que pode duplicar posts no Zernio** e **(3) logging que some no Railway sem agregação**. Resolvidos, a nota sobe pra 8-8.5.
