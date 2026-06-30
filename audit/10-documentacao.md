# Auditoria — Pilar 10: DOCUMENTAÇÃO & DX

**Data:** 2026-06-30
**Auditor:** Claude (Opus 4.7)
**Escopo:** documentação técnica, documentação de usuário, runbooks, DX local
**Nota:** **4.5 / 10**

---

## Resumo executivo

O projeto tem um conjunto razoável de docs internos (`CLAUDE.md`, 4× `SETUP-F2-*.md`, `DEPLOY-RAILWAY.md`, `COMO-FUNCIONA.md`), o que é mais do que a média de projetos one-man. Porém faltam várias peças críticas para um SaaS que está entrando em rodada de testes humanos:

- **Não existe `README.md` na raiz.** GitHub abre vazio. Devastador para onboarding e para impressão profissional.
- **`COMO-FUNCIONA.md` está no `.gitignore`** (linha 21). O melhor doc de usuário-final do projeto **não é versionado** e não chega no repo público/colaboradores.
- **Documentação de SETUP-F2 está incompleta:** existem 1, 2, 4 e 6, mas faltam SETUP-F2-3, F2-5 e F2-7 (mencionados como próximos passos nos arquivos existentes).
- Não há runbook de **rollback**, **disaster recovery**, **rollback de migration drizzle**, ou **como debugar cron travado**.
- Não há docs de USUÁRIO FINAL para o SaaS (vai entrar em teste humano sem manual). `COMO-FUNCIONA.md` é mais um one-pager conceitual que um guia de uso do produto.
- Não existe `CHANGELOG.md`, `CONTRIBUTING.md`, nem diagrama de arquitetura (C4, fluxo). O melhor diagrama é o ASCII em `SETUP-F2-4.md` (sequência de upload).

---

## Inventário do que EXISTE

| Documento | Status | Avaliação |
|-----------|--------|-----------|
| `CLAUDE.md` | OK | Excelente como contexto para LLM/dev voltando ao projeto. Cobre stack, regras inegociáveis, histórico de fases. Mas é orientado a "Claude Code" e não substitui README. |
| `COMO-FUNCIONA.md` | **Gitignored** | Bem escrito em linguagem simples (para Swell/Isa). Mas não está versionado — só existe na máquina do dono. Risco alto. |
| `DEPLOY-RAILWAY.md` | OK | Cobre F1 (3 crons no Railway). Bom passo-a-passo com divisão "você faz / claude faz". Defasado: a F1 evoluiu para F2.6 (worker + crons unificados). |
| `SETUP-F2-1.md` | OK | Multi-tenant + Neon + chave de criptografia. Bem detalhado. |
| `SETUP-F2-2.md` | OK | Clerk + Next.js. Bem detalhado. |
| `SETUP-F2-4.md` | OK | Upload pelo browser + worker local. Inclui diagrama ASCII de sequência (único do repo). |
| `SETUP-F2-6.md` | OK | Deploy Vercel + Railway + R2 CORS. Bem detalhado. |
| `.env.example` | Bom | 11 vars com comentários explicando origem (console URLs), distinção entre globais e legados, separação por fase. Falta: `SWELL_ADMIN_EMAIL` está no exemplo mas hardcoded `filmesswell@gmail.com` aparece em `SETUP-F2-2.md`. |
| `package.json` scripts | OK | 8 scripts com nomes em português claros (`dev`, `worker`, `db:push`, `r2:setup-cors`, `db:migrate-swell`). |
| Comandos CLI `--help` | Bom | `src/index.ts` tem `uso()` que lista todos os comandos com `--empresa`. |
| `nixpacks.toml` / `railway.json` | OK | Configs documentadas no infra layer. |
| Diagrama C4 / arquitetura | **Faltando** | Nenhum diagrama formal. ASCII em SETUP-F2-4 cobre 1 fluxo. |

---

## Inventário do que NÃO EXISTE

1. **`README.md`** — não existe na raiz. GitHub mostra repo vazio. Crítico.
2. **`CHANGELOG.md`** — não existe. Histórico só nos commits (`git log`) e parcialmente em `CLAUDE.md`.
3. **`CONTRIBUTING.md`** — não existe (talvez não precise, single-dev).
4. **`SETUP-F2-3.md`** — citado em SETUP-F2-2 como "próxima fase, conecta tabela do Notion". Não foi escrito.
5. **`SETUP-F2-5.md`** — citado em outras docs. Não foi escrito.
6. **`SETUP-F2-7.md`** — citado em SETUP-F2-6 ("F2.7 — admin de empresas (cadastrar empresa nova via UI)"). Não foi escrito apesar de existir código em `app/app/admin/empresas/`.
7. **Runbook de rollback** — o que fazer se um deploy Vercel quebrar? Se uma migration drizzle apagar coluna? Se a chave `ENCRYPTION_KEY` for perdida (mencionado em `.env.example` linha 29, mas sem plano)?
8. **Runbook de incident response** — Zernio cair, Notion cair, Neon ficar offline, R2 indisponível. Quem é notificado? Como degradar gracefully? Não há documentação.
9. **Manual do usuário final do SaaS** (não o conceito, o passo-a-passo na UI): "como aprovar um post", "como editar copy", "o que cada coluna do Notion significa", "como conectar Zernio Profile", "o que fazer se YouTube falhar".
10. **FAQ** — não existe.
11. **Arquitetura formal** — diagrama C4 (contexto, container, componente). Existe descrição textual fragmentada em CLAUDE.md e COMO-FUNCIONA.md.
12. **Runbook de cron debug manual** — como disparar um cron sem esperar o schedule? (existe `npm run distribuir -- --publicar-aprovados`, mas não está documentado como debug tool).
13. **Docs do schema do DB** — `src/db/schema.ts` é o source of truth, mas ninguém explica relações, ciclo de vida de jobs etc.
14. **Onboarding novo dev em 1 hora** — não existe checklist. Hoje precisaria ler 7+ arquivos `.md` em ordem que não está clara.

---

## Avaliação por critério (peso 1 cada)

| # | Critério | Score | Nota |
|---|----------|-------|------|
| 1 | README do projeto existe? | 0/10 | Não existe. Crítico. |
| 2 | Setup local documentado (clone→deps→env→run)? | 5/10 | Fragmentado em SETUP-F2-1/2; não há doc único "do zero ao app rodando". |
| 3 | `.env.example` completo com comentários? | 8/10 | Bom; tem comentários, fontes de onde pegar cada chave. Falta um par de vars edge (ex: avisar que SWELL_ADMIN_EMAIL precisa bater com login Clerk). |
| 4 | Runbook de deploy (Vercel+Railway+Neon)? | 7/10 | SETUP-F2-6 cobre bem. Falta atualizar quando F2 evoluir. |
| 5 | Runbook de rollback? | 0/10 | Inexistente. |
| 6 | Cron manual pra debug? | 4/10 | Comandos existem (`--publicar-aprovados`) mas não estão agrupados como "debug toolkit". |
| 7 | Como criar nova empresa (admin)? | 2/10 | Código existe (`app/app/admin/empresas/`), doc não. SETUP-F2-7 mencionado mas não escrito. |
| 8 | Como conectar Zernio Profile? | 3/10 | Mencionado em CLAUDE.md ("manualmente pelo Swell"), mas sem passo-a-passo no painel Zernio. |
| 9 | Como conectar Notion OAuth? | 4/10 | `.env.example` tem instruções (linhas 47-57) razoáveis; falta tutorial visual no app. |
| 10 | Comentários em código (externos)? | 6/10 | CLAUDE.md cobre lógica de alto nível bem. Falta JSDoc em funções públicas críticas. |
| 11 | Diagrama de arquitetura / fluxos? | 3/10 | Só 1 ASCII em SETUP-F2-4. Sem C4, sem diagrama de DB. |
| 12 | Runbook migrations Drizzle? | 3/10 | `db:push --force` é perigoso e não documentado como tal. |
| 13 | Onboarding novo dev (tempo)? | 3/10 | Estimo 4–6h pra um dev sênior se virar (precisa ler 7 mds + entender estrutura). Pode ser 1h com README + checklist. |
| 14 | DX local (hot reload, scripts, erros)? | 6/10 | `npm run dev` (Next), `npm run worker` (tsx) — funciona. Erros amigáveis em pontos críticos (`SETUP-F2-1.md` lista vários). Mas nada padronizado, sem `doctor`/`preflight` script. |
| 15 | Docs pro USUÁRIO FINAL (não-técnico)? | 2/10 | `COMO-FUNCIONA.md` é conceitual, não guia de uso. Não está no app. Está no `.gitignore`. |
| 16 | CHANGELOG? | 0/10 | Inexistente. |

**Média ponderada: ~3.7 → arredondado pra cima por reconhecimento de SETUP-F2 ser acima da média e pela qualidade de escrita: 4.5 / 10.**

---

## Achados críticos (priorizados)

### CRÍTICO 1 — `COMO-FUNCIONA.md` está no .gitignore
`.gitignore:21` lista `COMO-FUNCIONA.md`. O documento mais útil pra usuário não-técnico **não vai pro repo**. Em deploy/rollback/máquina nova, **vai sumir**. Provavelmente foi adicionado por engano (junto com `.claude/`).

**Arquivo afetado:** `/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL/.gitignore`

### CRÍTICO 2 — Não existe README.md
Crítico para SaaS que vai onboardar devs e impressionar parceiros. Mesmo um README curto com "o que é, como rodar local em 5 min, links pros SETUP-F2-*, link pro Notion" já tira a nota disso de 0 pra 7.

### CRÍTICO 3 — Sem runbook de rollback / disaster recovery
- Vercel deploy quebrou? Roteiro: "Promote previous deployment no painel."
- ENCRYPTION_KEY perdida? `.env.example:29` avisa que "segredos viram lixo" mas não dá plano. O plano deveria ser: "backupar a chave no 1Password com 2 cópias antes de prod."
- `db:push --force` aplicado errado? Drizzle não tem migration history per se, é destrutivo.
- Worker Railway derrubado? Quanto tempo até crons pararem? Quem percebe?

### ALTO 4 — SETUP-F2-3, F2-5, F2-7 não existem
Esses arquivos são citados em outros como "próxima fase" mas nunca foram escritos. Code da F2.7 (admin empresas) **existe em `app/app/admin/empresas/`** mas não há documentação de uso. Risco: dono volta em 6 meses e não sabe como cadastrar empresa nova.

### ALTO 5 — Sem manual de usuário final no app
SaaS entrando em teste humano sem:
- "Como fazer meu primeiro upload" (em-app tour)
- "Como aprovar" (tutorial)
- "Como editar copy no Notion"
- "Como conectar Zernio pela primeira vez"
- FAQ ("por que meu YouTube não publicou?")

Vai gerar carga de suporte alta pro Swell (dono).

### MÉDIO 6 — Sem CHANGELOG
Para SaaS em rodada de testes humanos, é crítico ter `CHANGELOG.md` para comunicar mudanças. `git log` não serve para usuário final.

### MÉDIO 7 — Sem diagrama de arquitetura formal
Único diagrama é o ASCII em `SETUP-F2-4.md` (fluxo de upload). Falta:
- C4-L1: contexto (quem usa, sistemas externos — Zernio, Notion, R2, Clerk, Anthropic)
- C4-L2: containers (Next.js Vercel, Worker Railway, Neon, R2)
- DB ERD (tenants, users, jobs, posts, tenant_secrets etc.)

### MÉDIO 8 — Sem `npm run doctor` ou preflight check
DX hoje: cada SETUP-F2 tem seção "Se algo der errado" com erros comuns mapeados (bom!). Mas não há um script que rode tudo: "DATABASE_URL ok? ENCRYPTION_KEY 32 bytes? ANTHROPIC_API_KEY válida? ffmpeg instalado? R2 reachable?".

### BAIXO 9 — `package.json:5` description é específica da Swell
Description está OK pra produto interno, mas se virar SaaS multi-tenant precisa generalizar.

### BAIXO 10 — `db:push --force` perigoso
`package.json:14` usa `--force` sem documentar. Em prod isso pode apagar coluna em uso.

---

## DX local — observações específicas

**Positivo:**
- Scripts em português (`distribuir`, `worker`) consistentes com a UI.
- `tsx` (não `ts-node`) — mais rápido, hot reload via `next dev` está implícito.
- Erros amigáveis em pontos críticos (SETUP-F2-1.md linhas 121-128).
- `--help` no CLI mostra todos os comandos com `--empresa`.

**Negativo:**
- Não existe `npm run check` ou `npm run preflight`.
- `npm run typecheck` existe mas não é parte de hook git ou CI.
- Nenhum CI configurado em `.github/workflows/` (não verifiquei diretório, mas não apareceu na árvore).
- ESLint não está em `package.json`. Sem linter, sem padronização.
- Prettier não está em `package.json`. Sem formatador.
- Sem `husky` ou pre-commit hooks.

---

## Recomendações priorizadas

### TIER 0 — Faz agora (30 min total)

1. **Tirar `COMO-FUNCIONA.md` do `.gitignore` e commitar.** É 1 linha de edit. Salva o doc.
2. **Criar `README.md` mínimo** (15 linhas):
   - O que é o projeto (1 parágrafo, link pra COMO-FUNCIONA.md)
   - Stack (1 linha)
   - Quick start (clone + npm i + cp .env.example .env + ler SETUP-F2-1)
   - Links pra todos os SETUP-F2-*.md
   - Link pra CLAUDE.md ("se você é um LLM ou voltando depois de 6 meses, leia primeiro")
3. **Criar `CHANGELOG.md`** com últimas ~20 entradas tiradas do `git log --oneline` agrupadas por mês.

### TIER 1 — Faz nesta semana (2-3h)

4. **Escrever `RUNBOOK.md`** com:
   - Rollback Vercel (promote previous deploy)
   - Rollback Railway (rollback deployment)
   - Backup/restore Neon (point-in-time recovery do plano free)
   - Backup da `ENCRYPTION_KEY` (1Password, 2 cópias)
   - Como rodar cron manualmente pra debug
   - Como migrar com drizzle SEM `--force` (gerar migration files com `drizzle-kit generate`)
   - Como inspecionar fila de jobs travados no Postgres
5. **Escrever `SETUP-F2-7.md`** (admin empresas) — código já existe em `app/app/admin/empresas/`.
6. **Escrever `docs/USUARIO.md`** para Swell/Isa (in-app or in-repo):
   - Como uploadar primeiro vídeo
   - Como aprovar (passo no Notion)
   - Como editar copy
   - Como conectar Zernio Profile (com screenshots do painel)
   - Como conectar Notion OAuth pelo botão do app
   - FAQ (Por que YouTube uploadou agora se eu agendei? Por que Instagram pediu thumbnail?)

### TIER 2 — Faz no mês (1 dia)

7. **Diagrama C4** (mermaid em markdown):
   - L1 (contexto): usuários → Swell SaaS → Zernio, Notion, R2, Anthropic, Neon, Clerk
   - L2 (containers): Next.js Vercel + Worker Railway + Neon Postgres + R2
   - DB ERD com mermaid `erDiagram`
8. **`scripts/doctor.ts`** — preflight check: env vars válidas, R2 reachable, Neon reachable, Anthropic key válida, ffmpeg instalado.
9. **CI mínimo** — `.github/workflows/typecheck.yml` rodando `npm run typecheck` em PR.
10. **ESLint + Prettier + Husky** — padronização básica.
11. **Reorganizar docs em `docs/`** — hoje tudo na raiz vira bagunça. Manter README, CLAUDE, CHANGELOG na raiz; mover SETUP-F2-* pra `docs/setup/` e criar `docs/runbook/`, `docs/usuario/`.

### TIER 3 — Backlog (depois)

12. Versionar docs com tags (`v0.1.0` etc.).
13. Tutorial in-app (tour interativo na primeira sessão do usuário).
14. Captura de telas anotadas para o doc de usuário.

---

## Nota final: 4.5 / 10

Justificativa:
- **+2:** SETUP-F2-* são acima da média (passo-a-passo claro, "você faz / claude faz", troubleshooting embarcado).
- **+1:** `.env.example` tem comentários úteis e separação por fases.
- **+1:** `CLAUDE.md` é um excelente contexto pra LLM/dev voltando.
- **+0.5:** `COMO-FUNCIONA.md` é bem escrito (mesmo gitignored).
- **-2:** Sem README — primeira impressão é projeto sem documentação.
- **-1:** `COMO-FUNCIONA.md` no `.gitignore`.
- **-1:** Sem runbook de rollback/disaster.
- **-1:** Sem manual de usuário final.
- **-1:** Sem CHANGELOG.
- **-0.5:** SETUP-F2-3/5/7 faltando, código já existe pra F2-7.

Para SaaS entrando em rodada de testes humanos, **a nota mínima aceitável seria 7**. As recomendações Tier 0 + Tier 1 (4-5h de trabalho) levam o projeto pra ~7.5.
