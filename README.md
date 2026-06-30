# Swell Mermaid

> SaaS de distribuição social pra produtoras audiovisuais premium.

Pega vídeos prontos, escreve a copy de cada rede com IA, espera aprovação humana e publica em Instagram, YouTube, TikTok e LinkedIn — tudo numa única chamada via API unificada (Zernio).

## O que faz

- **Análise + copy automática.** Claude assiste 6 frames do vídeo, decide redes/tom e escreve legendas no tom da produtora. Um segundo agente pontua 0–10 e reescreve até ficar bom.
- **Aprovação humana obrigatória.** Toda publicação passa pela fila no Notion. Nada vai ao ar sem alguém marcar `Aprovado`.
- **Agendamento estratégico.** Um terceiro agente sugere horário por rede; o cron `publicar-aprovados` agenda no Zernio quando bate a data.

## Stack

Next.js 16 + TypeScript, Neon Postgres, Cloudflare R2, Zernio (API unificada de redes), Notion (fila + log), Claude API (cérebro), Clerk (auth), Vercel + Railway (deploy).

## Quickstart (dev local)

```sh
git clone <repo>
cd "MERMAID AGENT SWELL"
npm install
cp .env.example .env        # preenche cada bloco (instruções dentro)
npm run db:push             # cria as tabelas no Neon
npm run db:migrate-swell    # migra os segredos da Swell pro banco cifrado
```

Pra subir o app + worker em dois terminais:

```sh
npm run dev                 # Next.js em http://localhost:4488
npm run worker              # processador de jobs + 3 crons
```

CLI direta (sem UI) pra um arquivo solto:

```sh
npm run distribuir -- ./caminho/video.mp4
npm run distribuir -- --help                # lista todos os comandos
```

Tipos:

```sh
npm run typecheck
```

## Estrutura

| Pasta          | O que tem                                                            |
| -------------- | -------------------------------------------------------------------- |
| `src/`         | Lógica core: brain, ingest, publish, storage, approval, log, CLI     |
| `app/`         | Next.js 16 (App Router) — UI, rotas e APIs                           |
| `components/`  | React components da UI                                               |
| `lib-web/`     | Helpers do lado web (auth, notion, format, validators)               |
| `worker/`      | Processo Node do Railway — jobs de upload + 3 crons                  |
| `scripts/`     | Setup e migrações pontuais (R2 CORS, migrate-swell, testes)          |
| `audit/`       | Auditoria interna de 11 pilares                                      |

## Documentos

- [COMO-FUNCIONA.md](./COMO-FUNCIONA.md) — explicação do fluxo em linguagem simples
- [RUNBOOK.md](./RUNBOOK.md) — deploy, rollback, debug de cron, backup da chave de criptografia
- [docs/USUARIO.md](./docs/USUARIO.md) — manual do usuário final (Swell, Isa)
- [PROXIMOS-PASSOS.md](./PROXIMOS-PASSOS.md) — roadmap (Onda 1/2/3) derivado da auditoria
- [audit/00-RELATORIO-FINAL.md](./audit/00-RELATORIO-FINAL.md) — auditoria completa
- [SETUP-F2-1.md](./SETUP-F2-1.md) — multi-tenant + Neon + chave de criptografia
- [SETUP-F2-2.md](./SETUP-F2-2.md) — Next.js + Clerk
- [SETUP-F2-4.md](./SETUP-F2-4.md) — upload pelo browser + worker local
- [SETUP-F2-6.md](./SETUP-F2-6.md) — deploy Vercel + Railway
- [DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md) — F1 (crons no Railway, defasado mas histórico)
- [CLAUDE.md](./CLAUDE.md) — contexto pro agente IA voltar ao projeto
