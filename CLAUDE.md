# CLAUDE.md — Agente de Distribuição Social da Swell Filmes

Este arquivo é o contexto do projeto. Leia ele inteiro no início de toda sessão antes de qualquer ação.

## O que estamos construindo

Um serviço que pega vídeos prontos da Swell Filmes, classifica o conteúdo, gera a copy de cada rede social, espera aprovação humana e publica em Instagram (Reels), YouTube, TikTok e LinkedIn. Swell Filmes é uma produtora audiovisual premium de Salvador. Os clientes são em boa parte B2B industrial (Austral, Metroval, Alcon, John Crane via Sabiá) mais conteúdo de portfólio e de marca.

## Stack (já decidida, não trocar sem perguntar)

- **Linguagem:** TypeScript / Node.
- **Cérebro (classificação + copy):** Claude API (SDK oficial da Anthropic). Saída sempre em JSON estruturado.
- **Hospedagem pública de mídia:** Cloudflare R2 (S3-compatível). As APIs de publicação puxam o vídeo de uma URL pública. Link do Google Drive não serve.
- **Publicação:** uma API unificada — **Zernio** (`@zernio/node`, https://zernio.com). UMA chamada (`zernio.posts.create`) publica em todas as redes informadas em `platforms`. OAuth de cada conta é feito uma vez via fluxo hospedado do Zernio (`zernio.accounts.connect`), manualmente pelo Swell. Não integrar a API nativa de cada rede.
- **Aprovação + Log:** Notion. Um banco serve de fila de aprovação e de histórico do que foi publicado.
- **Ingestão:** parse do nome do arquivo + leitura do Google Drive.

## Regras de arquitetura inegociáveis

1. **Nunca integrar a API nativa de Instagram, TikTok etc.** Sempre via API unificada. Isso evita App Review e tokens por rede.
2. **Toda mídia passa pelo R2 antes de publicar.** A URL pública do R2 é o que vai pra API de publicação.
3. **A porta de aprovação humana é obrigatória.** Nada é publicado sem alguém (Swell ou Isa) marcar como aprovado no Notion. Não automatizar essa decisão em hipótese alguma. É material de cliente.
4. **Conteúdo gerado por IA (vídeos Kling) deve sair com a flag de conteúdo AI ativada** na publicação. Exigência de Instagram e TikTok.
5. **Segredos só em variáveis de ambiente.** Nunca chave de API, token ou credencial no código ou no git. Mantenha um `.env.example` atualizado.

## Convenção de entrada (a equipe segue isso)

Vídeos prontos vão pra uma pasta no Drive chamada `_PUBLICAR`. O nome do arquivo carrega os metadados:

```
[cliente]_[tipo]_[orientacao].mp4
exemplos: austral_aftermovie_h.mp4 | metroval_reel_v.mp4 | becogelato_ai_v.mp4
```

- cliente: chave curta (austral, metroval, alcon, johncrane, becogelato...)
- tipo: aftermovie, reel, bastidor, institucional, minidoc, ai
- orientacao: `h` (16:9) ou `v` (9:16)

O parse do nome resolve quase tudo. A IA entra só pra copy e ambiguidade.

## Regras de roteamento (lógica do cérebro)

- 9:16 até 90s (reel, bastidor): Instagram Reels, YouTube Shorts, TikTok
- 16:9 (aftermovie, institucional): YouTube, LinkedIn
- 9:16 longo (minidoc): YouTube + sinalizar corte vertical
- Clientes B2B industrial: priorizar LinkedIn e YouTube, tom institucional
- tipo `ai`: ligar flag de conteúdo AI

Tom da copy: premium, cinematográfico, direto, sem clichê de marketing. Creditar a equipe quando couber e mencionar o cliente. Adaptar a legenda por rede.

## Estrutura do projeto (alvo)

```
src/
  config.ts        # carrega env, valida
  types.ts         # tipos compartilhados
  ingest/          # parse do nome + leitura do Drive
  storage/         # upload e limpeza no R2
  brain/           # chamada Claude: classifica e gera copy
  approval/        # cria linha no Notion e checa status
  publish/         # chamada à API unificada
  log/             # atualiza o Notion com links e status
  index.ts         # orquestrador / CLI
.env.example
```

## Variáveis de ambiente esperadas

```
ANTHROPIC_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS=   # caminho do JSON da service account
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=
NOTION_API_KEY=
NOTION_DB_ID=
ZERNIO_API_KEY=                   # chave da API unificada (Zernio)
```

## Plano de construção — FASE A FASE (regra crítica)

Construir uma fatia fina por vez, fim a fim. Não construir várias fases de uma vez. Ao terminar uma fase, parar e esperar revisão antes de seguir.

- **Fase 1 (MVP):** arquivo local de entrada → parse do nome → **extração de 6 frames com ffmpeg (`src/ingest/extrairFrames.ts`)** → cérebro (Sonnet 4.6) gera copy lendo a meta + os frames como imagens → upload no R2 → cria linha no Notion com status `Aguardando` → [aprovação manual no Notion] → publica via Zernio nas 4 redes (YouTube, Instagram, TikTok, LinkedIn) **em uma única chamada**. Cada rede só é incluída se a conta correspondente estiver conectada no painel do Zernio (env var `ZERNIO_<REDE>_ACCOUNT_ID` preenchida). Sem Drive automático ainda, entrada manual via CLI. *(Originalmente Fases 1–3 eram divididas por rede; o usuário consolidou em 2026-06-11 já que o Zernio publica em todas numa só chamada. Análise visual por frames adicionada na mesma data — sempre ativa.)*
- **Fase 2 — fatia A (pronta em 2026-06-11):** agendamento via Zernio (`scheduledFor`). Notion ganhou `DataPublicacao` (date), `PlanoJSON` (text), status `Agendado` e view "Calendário de Publicação". Quando o humano preenche `DataPublicacao` antes de marcar `Aprovado`, o programa (ou o cron `--publicar-aprovados` rodando a cada 15 min via launchd) agenda no Zernio em vez de publicar imediatamente.
- **Fase 2 — fatia B (pronta em 2026-06-11):** bulk ingest LOCAL: comando `--ingerir-pasta <caminho>` que varre uma pasta no PC (e subpastas), extrai frames, chama o cérebro pra inferir cliente/tipo/orientação, sobe no R2 e cria a linha Notion com `Status=Aguardando` sem esperar aprovação (enfileira). Idempotência: cada arquivo é hash do caminho absoluto, salvo em `DriveFileId` (nome do campo virou semântico de "SourceId"). Pra publicar: usuário preenche DataPublicacao + marca Aprovado, cron `--publicar-aprovados` agenda no Zernio. **Originalmente seria via Google Drive API**, mas a política do Workspace da Swell bloqueia criação de chaves de service account; usuário optou por copiar arquivos pro PC.
- **Fase 2 — fatia B+ (pronta em 2026-06-11):** pipeline de qualidade completa. Depois do cérebro + redator (tom Swell), também roda um **avaliador-corretor** (`--avaliar-copy`, src/brain/avaliador.ts) que pontua cada caption 0-10 e reescreve até 10. E um **agendador estratégico** (`--agendar-todas`, src/brain/agendador.ts) que olha todas as linhas Aguardando + analisa best times por rede + espaçamento, e preenche DataPublicacao em todas de uma vez (1 chamada Claude, max_tokens=16384 pra caber 50+ entradas). PlanoJSON e Copy agora usam `chunkRichText` (src/lib/notionChunks.ts) pra escapar do limite de 2000 chars/bloco do Notion.
- **Fase 2 — fatia D (pronta em 2026-06-12):** geração de thumbnails. Agente em `src/brain/thumbnailAgent.ts` avalia frames 0-10 com Claude vision. Helper `src/brain/gerarThumbnail.ts` itera (round 1 = 6 frames padrão, round 2 = 6 deslocados se nenhum >= 7) e devolve URL pública (frame hi-res 1280px no R2). Salva em PlanoJSON.thumbnailUrl e na coluna Notion `ThumbnailUrl`. Anexa em `mediaItems[0].thumbnail` + `instagramThumbnail` no Zernio. Sincronizado pra agendados via cron `--sincronizar-edits-zernio` (a cada 10min) e comando manual `--gerar-thumbnails <de> <ate>`. Roda automaticamente no `--ingerir-pasta` e `--distribuir`.
- **Fase 2 — fatia C (pendente):** trigger automático: vigia uma pasta `_PUBLICAR` local e dispara a ingestão quando arquivo novo aparecer. Mais corte vertical automático (FFmpeg) e limpeza do R2.

## O que NÃO fazer

- Não construir além da fase atual sem aprovação.
- Não pular a porta de aprovação humana.
- Não tentar fazer as conexões OAuth das redes em código: isso é feito uma vez no painel da API unificada, manualmente pelo Swell. O código só usa a chave.
- Não colocar segredos no código nem commitar `.env`.

## Definição de pronto da Fase 1

`npm run distribuir -- ./caminho/video.mp4` roda o fluxo até criar a linha no Notion e, após aprovação manual, publica no YouTube. Com logs claros em cada passo e tratamento de erro que avisa em vez de falhar em silêncio.
