# SETUP-F2-6 — Deploy: Mac pode ficar desligado

> **Esta é A fase.** Quando terminar:
> - O app está em `https://swell-distribuidor.vercel.app` (qualquer pessoa loga)
> - Os 3 crons + worker rodam no Railway 24/7
> - Você desliga os launchd do Mac
> - **Mac pode ficar fechado. Posts agendados continuam publicando.**

## Visão geral

```
GitHub repo (código)
       │
       ├──► Vercel  ──► serve o app web (Next.js)
       └──► Railway ──► roda o worker (jobs + 3 crons)

Neon Postgres ←──── ambos
R2 / Notion / Zernio ←──── ambos
```

Custo total: ~$5/mês (Railway Hobby) + ~$0 (Vercel Hobby) + ~$0 (Neon free).

## Sequência

1. **Você** cria repo vazio no GitHub
2. **Eu** faço push do código
3. **Você** conecta Vercel + cola env vars → deploy do app
4. **Você** conecta Railway + cola env vars → deploy do worker
5. **Eu** atualizo CORS R2 pra incluir o domínio Vercel
6. **Você** desliga os 3 launchd do Mac
7. ✅ Mac livre

---

## Passo 1 — Você cria o repo no GitHub

1. Abre **github.com** logado com sua conta
2. Botão **+** no topo direito → **New repository**
3. Repository name: `swell-distribuidor`
4. Marca **Private** (importante — tem nomes de cliente no histórico)
5. **NÃO marca** nenhuma das caixas de "Initialize with"
6. **Create repository**
7. Na tela que aparece, copia a URL **HTTPS** ou **SSH** (o que você usa) — algo tipo:
   - HTTPS: `https://github.com/seuusuario/swell-distribuidor.git`
   - SSH: `git@github.com:seuusuario/swell-distribuidor.git`
8. Cola aqui no chat

## Passo 2 — Eu faço o push

Quando você me passar a URL, rodo `git remote add` + `git push -u origin main` e te aviso quando terminar.

## Passo 3 — Você conecta Vercel

1. Abre **vercel.com** → **Sign Up** (use a mesma conta GitHub do passo 1)
2. **Add New** → **Project** → seleciona `swell-distribuidor` da lista (Vercel já viu via GitHub)
3. Framework Preset: **Next.js** (auto-detectado)
4. Root Directory: `./` (padrão)
5. Antes de clicar deploy, expande **Environment Variables** e cola as variáveis abaixo (uma por uma — copia do seu `.env`):

```
ANTHROPIC_API_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_BASE_URL
DATABASE_URL
ENCRYPTION_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
SWELL_ADMIN_EMAIL
```

6. **Deploy**. Aguarda ~3min.

7. Quando finalizar, Vercel mostra a URL `https://swell-distribuidor-xxxx.vercel.app`. Cola aqui no chat (preciso pra atualizar CORS).

## Passo 4 — Você conecta Railway (worker + crons)

1. Abre **railway.app** → **Login with GitHub**
2. Plano: **Hobby ($5/mês)** — necessário pra rodar 24/7
3. **New Project** → **Deploy from GitHub repo** → seleciona `swell-distribuidor`
4. Espera o primeiro build (~3-5min). Vai dar erro de env vars — é esperado.
5. Clica no serviço → aba **Variables** → cola as 8 variáveis abaixo (do `.env`):

```
ANTHROPIC_API_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_BASE_URL
DATABASE_URL
ENCRYPTION_KEY
```

(Vercel-only: NEXT_PUBLIC_CLERK_*, CLERK_SECRET_KEY, SWELL_ADMIN_EMAIL. Railway não precisa.)

6. Aba **Settings** → **Service** → **Start Command**: cola `npm run worker`
7. Aba **Settings** → **Service** → **Restart Policy**: `On Failure`
8. Renomeia o serviço pra `worker` (canto superior esquerdo do serviço).
9. Clica **Deploy** (botão no topo). Aguarda.
10. Aba **Deployments** → último → **View Logs**. Deve ver:
    ```
    [worker -] [boot] worker subindo...
    [worker -] [cron] ✅ schedules ativos: publicar (*/5min) · sincronizar (*/10min) · atualizar (12h)
    [worker -] [jobs] polling a cada 5s...
    ```

Se ver isso: o worker + os 3 crons estão rodando no Railway.

## Passo 5 — Eu atualizo CORS R2 com o domínio Vercel

Quando você me passar a URL do Vercel, atualizo `scripts/setup-r2-cors.ts` pra incluir e te peço pra ir no dashboard da Cloudflare e atualizar (já que a API key não tem permissão de CORS).

## Passo 6 — Você desliga os 3 crons do Mac

**SÓ depois de confirmar que tudo no Railway está rodando.** Os 3 crons no Mac
continuam rodando até esse passo (= redundância segura).

No terminal:

```sh
launchctl unload ~/Library/LaunchAgents/com.swell.distribuidor.atualizar-pendentes.plist 2>/dev/null
launchctl unload ~/Library/LaunchAgents/com.swell.distribuidor.publicar-aprovados.plist 2>/dev/null
launchctl unload ~/Library/LaunchAgents/com.swell.distribuidor.sincronizar-edits.plist 2>/dev/null
echo "✅ launchd desligado. Mac pode hibernar."
```

Os arquivos `.plist` continuam em `~/Library/LaunchAgents/` caso você queira voltar.

## Passo 7 — Test final

1. Fecha o `npm run dev` local
2. Vai em `https://swell-distribuidor-xxxx.vercel.app` → loga → testa upload
3. Acompanha logs no Railway (aba Deployments → View Logs do worker)
4. Confere que o post novo apareceu na tabela

## ✅ Pronto

Mac pode ficar off. Toda a Swell roda no cloud.

## O que não foi feito ainda (futuro)

- F2.7 — admin de empresas (cadastrar empresa nova via UI)
- Domínio próprio (`distribuidor.swellfilmes.com.br` em vez de `.vercel.app`)
- Billing por empresa
- Notificações por email/Slack
