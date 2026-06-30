# Auditoria — Pilar 09: TESTES & QA

**Data:** 2026-06-30
**Escopo:** Swell Mermaid (SaaS multi-tenant em produção, iniciando rodada de testes humanos)
**Auditor:** Claude (Opus 4.7)

---

## Nota: 0,5 / 10

Praticamente inexistente. A única coisa que evita um zero absoluto é o `npm run typecheck` (tsc --noEmit) com `strict: true` em `tsconfig.json` — esse é o ÚNICO mecanismo automatizado de verificação de qualidade no repo. Não há testes, CI, lint, hooks, staging documentado, mocks, nem QA documentado.

---

## Justificativa

Varredura completa do repo (`find -name "*.test.ts" -o -name "*.spec.ts" -o -name "vitest.config*" -o -name "jest.config*" -o -name "playwright.config*"`): **zero resultados**. Em `package.json` não há `vitest`, `jest`, `playwright`, `@testing-library/*`, `mocha`, `chai`, `supertest`, `msw`. Não há scripts `test`, `lint`, `format` ou `prepare`. Sem `.github/` (não há `.github/workflows/`), sem `.husky/`, sem `.eslintrc*`, sem `.prettierrc*`, sem `biome.json`, sem `lint-staged`.

Os três arquivos com "test" no nome em `scripts/` (`test-cerebro.ts`, `test-frames-cerebro.ts`, `test-r2.mjs`) são **smoke scripts manuais** que chamam a API real (Claude/R2) com dados fake e imprimem `console.log` — não usam framework de teste, não têm asserções automatizadas, não rodam em CI, não falham em regressão. São utilitários de bring-up, não testes.

Single source of truth de qualidade hoje: `tsc --noEmit` rodado **manualmente** + o build do Next na Vercel + o build do worker no Railway. Nenhum dos dois é bloqueante via PR check (não há PR check). Deploy automático no push do `main` (Vercel/Railway) sem gate de qualidade — isso é especialmente perigoso agora que entra rodada de testes com humanos reais.

---

## Pontos Fortes

- **TypeScript strict ligado** (`tsconfig.json:11`): `strict: true`, `noEmit: true`, `isolatedModules: true`. Isso pega uma classe inteira de bugs em tempo de compilação e é o que está segurando a casa.
- **`npm run typecheck` existe** como script (linha 13 do `package.json`) — então rodar `tsc` no CI seria literalmente uma linha.
- **Validação de input via Zod** (`zod ^3.23.8` em dependencies) — runtime checks em entradas críticas substituem parcialmente unit tests de domínio (mas só onde está sendo usado de fato).
- **Build do Next em produção** funciona como smoke test implícito (se a página quebra em build, Vercel falha o deploy).

---

## Problemas Críticos

1. **ZERO testes automatizados** num SaaS multi-tenant em produção que mexe com mídia de cliente, agendamento e publicação em redes sociais. Domínios de alto risco sem rede: `src/publish/zernio.ts` (publica de verdade), `lib-web/reconciliarCopy.ts` (decide o que vai pro Zernio), `src/brain/*` (IA gera conteúdo de cliente), `worker/handlers/ingest.ts` (ffmpeg/R2/Notion). Um typo silencioso aqui causa post errado na conta do cliente.

2. **Sem CI/CD pipeline.** Não existe `.github/workflows/`. O `npm run typecheck` só roda se o dev lembrar. O push direto pro `main` faz deploy na Vercel (frontend) e Railway (worker) sem nenhum gate — typecheck, lint, build local, nada. Já há histórico de fixes pós-deploy (`fix(railway): builder RAILPACK → NIXPACKS pra instalar ffmpeg`, `fix(worker): MAX_CONCURRENCY 2 → 1`, `fix(ingest): serializar 6 ffmpegs`) — exatamente os bugs que um pipeline de teste/staging pegaria antes.

3. **Sem ESLint/Prettier/Biome.** Estilo de código depende 100% do dev/IDE. Sem `no-floating-promises`, sem `no-unused-vars`, sem `await-thenable`. Num projeto com muito `async`/`await` (Zernio, Notion, R2, Claude) isso esconde promises não-awaited que silenciosamente falham.

4. **Sem pre-commit hooks (husky/lint-staged/lefthook).** Dá pra commitar TypeScript que nem compila. Nada force `npm run typecheck` antes do `git push`.

5. **Sem ambiente de staging.** Production-only deployment. A rodada de testes humanos que está começando vai rodar em cima do banco e das contas Zernio de produção — qualquer bug atinge dados reais.

6. **Sem smoke test pós-deploy.** Nenhum healthcheck monitorado, nenhum `curl` de verificação que confirme que `/api/upload/url` ou o cron do worker estão respondendo depois do deploy.

7. **Sem regressão dos bugs históricos.** O `MEMORY.md` lista vários bugs já corrigidos (banner, dashboard check, contraste, data passada → publishNow, YouTube upload imediato, R2 limpeza, edits Copy no Notion, OOM). Nenhum deles tem teste guardião — nada impede que voltem.

8. **Sem mock factories nem fixtures de teste.** Não há como exercitar `gerarPlano()`, `reconciliarPlanoComNotion()` ou `publicarNoZernio()` sem chamar API real. Isso torna qualquer teste futuro caro de escrever.

9. **Sem QA manual documentado.** Nenhum checklist em `/audit`, `/docs`, ou `COMO-FUNCIONA.md` que diga "antes de release, valide X/Y/Z". Os `SETUP-F2-*.md` são docs de setup, não de QA.

10. **Type-check não é mandatório.** Não há branch protection, nem PR template, nem GH Action. Um membro do time pode mergear código sem rodar `tsc`.

---

## Recomendações Priorizadas

### P0 — Antes da rodada de testes humanos (1-2 dias)

1. **Criar `.github/workflows/ci.yml`** rodando `npm ci && npm run typecheck && npm run build` em todo PR e push pro `main`. Bloqueia merge se falhar. 30 min de trabalho, salva semanas.

2. **Adicionar Vitest + 5-10 unit tests dos domínios de maior risco:**
   - `src/ingest/parseNome.ts` (parser puro, fácil de testar — `austral_aftermovie_h.mp4` → `{cliente:'austral', tipo:'aftermovie', orientacao:'h'}` e edge cases).
   - `lib-web/reconciliarCopy.ts` (regra crítica "Copy editado vence PlanoJSON" do MEMORY.md — teste guardião).
   - `src/publish/zernio.ts` — mockar `@zernio/node` e validar shape do body (`platformSpecificData`, `containsSyntheticMedia`, `scheduledFor` no passado → `publishNow`).
   - Roteamento de redes em `src/brain/cerebro.ts` (9:16 ≤90s → Reels/Shorts/TikTok; 16:9 → YouTube/LinkedIn).

3. **Branch protection no `main`** no GitHub: exigir CI verde antes de merge. Zero custo.

### P1 — Primeira semana de testes humanos

4. **ESLint + `@typescript-eslint/no-floating-promises` + `no-misused-promises`.** Numa codebase com muito async, esse plugin sozinho previne uma classe inteira de bugs silenciosos.

5. **Pre-commit hook com Husky + lint-staged**: roda `tsc --noEmit` e `eslint` nos arquivos staged. ~15 min de setup.

6. **Smoke test pós-deploy**: GitHub Action `deploy-smoke.yml` que, depois do deploy da Vercel, faz `curl` em `/api/health` (criar essa rota se não existe) e `/api/upload/url` (HEAD). Notifica falha por email.

7. **Testes de regressão dos bugs do MEMORY.md** — um teste por linha já corrigida (data passada → publishNow, banner, dashboard check, contraste, edits do Copy). Isso transforma `MEMORY.md` em suite executável.

### P2 — Antes de escalar pra outras empresas

8. **Ambiente de staging em Vercel + Railway** (branch `staging` com banco Neon separado e contas Zernio sandbox). Rodada de testes humanos deveria rodar aqui, não em prod.

9. **Integration tests** com Notion/Zernio/R2 mockados via `msw` ou `nock`, exercitando o fluxo `ingerirArquivo → criarLinhaNotion → publicar` sem rede.

10. **Playwright E2E** do fluxo crítico: upload na UI → ver linha no dashboard → editar Copy → aprovar → confirmar chamada Zernio. Pelo menos 1 happy path e 1 erro (Zernio retorna 4xx).

11. **Mock factory central** em `tests/factories/` (`fakeMeta()`, `fakePlano()`, `fakeNotionRow()`, `fakeZernioPost()`) pra qualquer novo teste custar 2 linhas.

12. **QA checklist em `audit/QA-CHECKLIST.md`** antes de cada release manual: testar publish em cada uma das 4 redes, agendamento futuro, agendamento passado, conteúdo AI flag, bulk upload, edit de Copy depois de aprovar.

---

## Resumo executivo

Atualmente: **zero testes, zero CI, zero lint, zero staging.** Único gate de qualidade é `tsc --noEmit` rodado manualmente e o build da Vercel. Para um SaaS multi-tenant em produção mexendo com conteúdo pago de cliente e publicando em redes sociais reais, isso é risco alto. P0 (CI + 5 unit tests + branch protection) é tudo de ~4h de trabalho e tira o projeto de "nota 0" pra "nota 4" antes da rodada com humanos começar.
