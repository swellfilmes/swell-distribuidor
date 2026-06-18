# DEPLOY-RAILWAY.md — F1: sair do Mac, subir pro Railway

> **Objetivo da F1:** rodar os 3 crons num servidor na nuvem, sem mudar uma linha de lógica.
> Quando isso estiver pronto, seu Mac pode ficar desligado que as publicações continuam.

## Divisão de trabalho

- **VOCÊ faz:** criar repo no GitHub, criar conta Railway, colar variáveis de ambiente no painel, validar.
- **EU faço (Claude):** todo o resto que é código/arquivo no projeto.

---

## Passo 1 — Você cria o repositório no GitHub

1. Abre **github.com** → botão **New repository** (canto superior direito)
2. Repository name: `swell-distribuidor`
3. **Privado** (marca a opção "Private" — importante porque tem nomes de cliente)
4. NÃO marca nenhuma das caixas de "Initialize"
5. **Create repository**
6. Na tela que aparece, copia a URL — vai ter dois formatos, copia o **SSH** (algo tipo `git@github.com:seuusuario/swell-distribuidor.git`)
7. Me cola aqui

## Passo 2 — Eu conecto o projeto local ao GitHub

(Com a URL que você me der, eu rodo `git init`, faço o primeiro commit e dou push. Te aviso quando terminar.)

## Passo 3 — Você cria conta no Railway

1. **railway.app** → **Login with GitHub** (usa a mesma conta GitHub do Passo 1)
2. Autoriza o Railway a ver seus repos
3. Plano: **Hobby ($5/mês) ou Pro ($20/mês)** — pro nosso uso o Hobby basta pra começar

## Passo 4 — Você cria o projeto no Railway

1. **New Project** → **Deploy from GitHub repo** → escolhe `swell-distribuidor`
2. Vai aparecer um serviço sendo criado. Espera o primeiro deploy terminar (~3-5 min).
3. **Aqui pode dar erro de "missing env vars"** — é esperado, é só passar pro próximo passo.

## Passo 5 — Você cola as variáveis de ambiente

No painel do Railway, abre o serviço → **Variables** → cola as 12 variáveis abaixo
(pega os valores do seu `.env` local). **NÃO me mande os valores**, só cola direto no painel:

```
ANTHROPIC_API_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_BASE_URL
NOTION_API_KEY
NOTION_DB_ID
ZERNIO_API_KEY
ZERNIO_YOUTUBE_ACCOUNT_ID
ZERNIO_INSTAGRAM_ACCOUNT_ID
ZERNIO_TIKTOK_ACCOUNT_ID
ZERNIO_LINKEDIN_ACCOUNT_ID
```

## Passo 6 — Transformar o serviço em 3 Cron Jobs

Vamos fazer um por vez. Pro PRIMEIRO:

1. No serviço atual, vai em **Settings** → **Service** → **Cron Schedule**
2. Cole: `*/5 * * * *` (a cada 5 min)
3. **Settings** → **Deploy** → **Custom Start Command**: `npm run distribuir -- --publicar-aprovados`
4. Salva. Renomeia o serviço pra `publicar-aprovados`.

Pros outros dois, **duplica** o serviço (botão no painel) e troca:

| Serviço | Cron Schedule | Start Command |
|---|---|---|
| `publicar-aprovados` | `*/5 * * * *` | `npm run distribuir -- --publicar-aprovados` |
| `sincronizar-edits-zernio` | `*/10 * * * *` | `npm run distribuir -- --sincronizar-edits-zernio` |
| `atualizar-pendentes` | `0 12 * * *` | `npm run distribuir -- --atualizar-pendentes` |

## Passo 7 — Validar

1. No serviço `publicar-aprovados` → botão **Deploy** ou **Run Now** pra disparar manual
2. Abre **Deployments** → último deploy → **View Logs**
3. Você deve ver os logs como vê no terminal hoje (`[12:34:56] [agendar] ...`)
4. Se aparecer erro de `ffmpeg: not found`, me avisa — significa que o `nixpacks.toml` não pegou

## Passo 8 — Desligar os crons do Mac

Só depois do Passo 7 confirmar tudo OK, **eu desligo os 3 crons do launchd**:

```sh
launchctl unload ~/Library/LaunchAgents/com.swell.distribuidor.atualizar-pendentes.plist
launchctl unload ~/Library/LaunchAgents/com.swell.distribuidor.publicar-aprovados.plist
launchctl unload ~/Library/LaunchAgents/com.swell.distribuidor.sincronizar-edits.plist
```

Os arquivos `.plist` ficam guardados no `~/Library/LaunchAgents/` caso a gente queira voltar.

---

## O que essa F1 ainda NÃO faz

- ❌ Não tem frontend ainda (F2)
- ❌ O comando `npm run distribuir -- ./video.mp4` (subir um vídeo) **continua local** — ele depende do arquivo no seu Mac. Vira o botão de upload na F2.
- ❌ O `--ingerir-pasta` também continua local (mesma razão).

Os 3 crons agendados são exatamente o que sobra rodando "sozinho", e é o que mais te prende ao Mac hoje.
