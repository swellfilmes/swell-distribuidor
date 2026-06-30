# RUNBOOK — Operação do Swell Mermaid

Guia operacional pra quando algo precisar ser feito ou consertado em produção. Estilo: comando + saída esperada.

---

## Deploy

### Vercel (app web)

Deploy automático. Todo `git push origin main` dispara um build novo.

Verificar:

1. Abre **vercel.com** → projeto `swell-distribuidor`.
2. Aba **Deployments** → último deploy deve estar em **Ready** (verde).
3. Clica no domínio (`https://swell-distribuidor.vercel.app`) e confirma que o login carrega.
4. Em **Build Logs**, procura erros de build (TypeScript, Next).

### Railway (worker + crons)

Deploy automático também. Push em `main` rebuilda o serviço `worker`.

Verificar:

1. **railway.app** → projeto → serviço `worker`.
2. Aba **Deployments** → último deve estar **Active**.
3. **View Logs** — espera ver:
   ```
   [worker -] [boot] worker subindo...
   [worker -] [cron] schedules ativos: publicar (*/5min) · sincronizar (*/10min) · atualizar (12h)
   [worker -] [jobs] polling a cada 5s...
   ```

---

## Rollback Vercel

Quando: deploy quebrou produção, página inicial 500, login não carrega.

1. **vercel.com** → projeto → aba **Deployments**.
2. Filtra por **Production** + **Ready** (verde).
3. Acha o último deploy bom (anterior ao quebrado).
4. Clica nos `…` à direita → **Promote to Production**.
5. Confirma. Vercel aponta o domínio pro deploy antigo em ~30s.
6. Testa o site.
7. Abre issue/nota explicando o que quebrou pra arrumar antes do próximo push em `main`.

---

## Rollback Railway

Quando: worker travou, crons pararam de rodar, logs cheios de erro.

1. **railway.app** → serviço `worker` → aba **Deployments**.
2. Acha o último deploy que estava **Active** sem erros.
3. Clica nos `…` → **Redeploy**.
4. Aguarda ~2min. Confirma nos logs que o boot apareceu.
5. Se mesmo o anterior estiver quebrado: aba **Variables** confere se alguma env mudou; **Settings → Service → Start Command** deve ser `npm run worker`.

---

## Backup da `ENCRYPTION_KEY` (CRÍTICO)

Essa chave (env var `ENCRYPTION_KEY`, 32 bytes base64) cifra **todos os segredos das empresas no banco** (Notion API keys, Zernio API keys, account IDs). **Se for perdida, vira lixo irrecuperável** — toda empresa cadastrada perde acesso aos próprios segredos e precisa reconectar tudo do zero.

Onde guardar (escolha 2, NUNCA só 1):

1. **1Password** (ou Bitwarden) — vault da Swell, item chamado `Swell Mermaid · ENCRYPTION_KEY`.
2. **Cofre offline** — papel impresso ou pendrive cifrado, guardado em local físico (escritório, casa).
3. **Documento criptografado compartilhado com 2 pessoas** (Swell + Isa, por exemplo).

Boa prática: rotacionar nunca antes de implementar key rotation (não existe ainda). Hoje a chave é fixa, então o foco é não perder.

Pra ver a chave atual (sem revelar em logs):

```sh
grep ENCRYPTION_KEY .env | awk -F= '{print substr($2,1,4)"..."substr($2,length($2)-3)}'
```

---

## Debugar cron manualmente

Os 3 crons rodam no Railway no `npm run worker`. Pra testar local ou disparar à mão:

### Publicar aprovados (a cada 5min em prod)

```sh
npm run distribuir -- --publicar-aprovados
```

Esperado: lista os posts com `Status=Aprovado` e `DataPublicacao` próxima, agenda no Zernio. Sem nada pra publicar: imprime "nenhum post pra agendar".

### Sincronizar edits do Zernio (a cada 10min em prod)

```sh
npm run distribuir -- --sincronizar-edits-zernio
```

Esperado: pega posts `Agendado` no Notion e re-envia thumbnail/copy editados pro Zernio (até o cutoff dele).

### Atualizar status de pendentes (12h em prod)

```sh
npm run distribuir -- --atualizar-pendentes
```

Esperado: refresca posts `Publicando`/`Parcial` puxando status do Zernio e atualizando o Notion.

### Ingerir uma pasta local

```sh
npm run distribuir -- --empresa swell --ingerir-pasta "/Users/.../pasta" --max 10
```

### Ver logs do worker no Railway

1. **railway.app** → `worker` → **Deployments** → último → **View Logs**.
2. Filtra por nível ou por palavra (`[publicar]`, `[ingest]`, `[error]`).
3. Logs são efêmeros (sem retenção longa) — pra retenção longa, plugar Sentry/Better Stack (Onda 1 do roadmap).

---

## Banco de dados (Neon)

### Aplicar mudança de schema

```sh
npm run db:push
```

**ATENÇÃO**: o script usa `drizzle-kit push --force`. Se você renomeou ou removeu coluna em `src/db/schema.ts`, o `--force` aplica **sem confirmação destrutiva**. Sempre:

1. Antes: ver o diff (`drizzle-kit push` sem `--force` mostra o plan).
2. Em prod: rodar primeiro num **branch de dev** da Neon.

### Criar branch de dev na Neon (recomendado)

1. **console.neon.tech** → projeto `swell-distribuidor` → aba **Branches**.
2. **New Branch** → nome `dev-<data>` → **From: main**.
3. Copia a connection string desse branch.
4. Cola num `.env.dev` e roda `DATABASE_URL=<dev> npm run db:push`.
5. Testa. Quando ok, aplica em `main`.

### Conexão direta (psql)

```sh
psql "$DATABASE_URL"
```

Comandos úteis dentro do psql:
- `\dt` — lista tabelas
- `SELECT id, slug, nome FROM empresas;`
- `SELECT id, status, criado_em FROM jobs ORDER BY id DESC LIMIT 20;`

---

## R2 (Cloudflare)

### Estrutura

```
mermaid/                                # bucket
  tenants/{empresaId}/publicar/{hash}/  # vídeos enviados
  tenants/{empresaId}/thumbs/{...}      # thumbnails geradas
```

### Listar objetos do CLI

```sh
aws s3 ls "s3://$R2_BUCKET/tenants/1/publicar/" \
  --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
```

(Pré-requisito: `aws configure` apontando pra `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`.)

### Reconfigurar CORS (quando trocar domínio Vercel)

Edita `scripts/setup-r2-cors.ts` adicionando a origem nova e roda:

```sh
npm run r2:setup-cors
```

---

## Notion

### Recriar DB de uma empresa

O DB principal (fila de aprovação) é criado via OAuth Notion no primeiro onboarding da empresa. Se foi apagado por engano:

1. Pede pro dono da empresa **desconectar** Notion no app (`/app/configuracoes`).
2. Pede pra **reconectar** — o backend cria o DB do zero com schema atualizado.

O DB de clientes (multi-cliente, ZernioProfileId etc.) precisa ser criado manualmente pelo dono. Schema esperado está em `src/clientes/notionClientes.ts` (linhas 14+). Setar a env/segredo `NOTION_CLIENTS_DB_ID` ou guardar em `tenant_secrets.notion_clients_db_id` cifrado.

### Adicionar coluna nova ao DB de fila

1. Edita `src/approval/notionSchema.ts` (helper que cria/migra colunas).
2. Roda em dev contra DB de teste.
3. Em prod, abrir o Notion manualmente e adicionar a coluna no DB de cada empresa (não tem migração automática ainda).

---

## Healthcheck

Hoje não tem endpoint `/api/health` nem Sentry. Está no roadmap (Onda 1).

Pra monitorar manual enquanto não tem:

- **Vercel**: `https://swell-distribuidor.vercel.app/sign-in` deve responder 200.
- **Railway**: logs do worker — boot deve aparecer todo restart.
- **Neon**: cliente do Vercel falhando = ela dormiu (free tier). Acorda na primeira query.

---

## Recriar Profile Zernio de uma empresa testadora

Quando a empresa não tem `zernio_profile_id` no banco ainda (ou foi deletado no painel Zernio):

```sh
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: <cookie de sessão>" \
  https://swell-distribuidor.vercel.app/api/empresas/<empresaId>/zernio-profile
```

Esperado: cria o Profile no Zernio, salva o ID cifrado em `tenant_secrets`, devolve `{ ok: true, profileId }`. Depois o dono conecta cada rede pelo painel Zernio.

Local:

```sh
curl -X POST http://localhost:4488/api/empresas/<empresaId>/zernio-profile
```

(Em local, autenticação via Clerk dev — precisa estar logado no browser na mesma sessão.)

---

## Rodar local com env de produção (CUIDADO)

Útil pra debugar bug que só aparece em prod. Riscos: você pode **publicar de verdade**, **alterar Notion de cliente real** ou **subir lixo no R2 de prod**.

1. Copia `.env` de prod pra `.env.prod-local` (NÃO commita).
2. Antes de rodar, comenta:
   - `ZERNIO_API_KEY` (impede publicar)
   - `NOTION_API_KEY` (impede mexer no Notion real)
3. Roda:
   ```sh
   env $(cat .env.prod-local | grep -v '^#' | xargs) npm run dev
   ```
4. Quando terminar, **apaga `.env.prod-local`**.

Alternativa segura: use o **branch de dev da Neon** + um workspace Notion separado de teste.
