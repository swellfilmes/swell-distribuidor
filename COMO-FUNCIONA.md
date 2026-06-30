# Como funciona o Agente de Distribuição da Swell Filmes

> Guia em linguagem simples — sem jargão técnico.

---

## O que é isso?

É um **robô digital** que pega os vídeos prontos da Swell e, com a ajuda de inteligência artificial, faz tudo que normalmente seria feito à mão:

1. Entende o que tem no vídeo
2. Escreve a legenda certa para cada rede social
3. Espera você aprovar
4. Publica automaticamente no horário certo

---

## O fluxo completo — passo a passo

```
Vídeo pronto
     │
     ▼
① ENTRADA — o robô recebe o arquivo
     │
     ▼
② ANÁLISE — IA assiste frames do vídeo e entende o conteúdo
     │
     ▼
③ COPY — IA escreve as legendas para cada rede
     │
     ▼
④ APROVAÇÃO — você revisa e aprova no Notion
     │
     ▼
⑤ PUBLICAÇÃO — robô posta nas redes automaticamente
     │
     ▼
⑥ REGISTRO — Notion atualiza com os links publicados
```

---

## Cada etapa explicada

### ① Entrada
Você coloca o arquivo de vídeo na pasta `_PUBLICAR` do computador (ou sobe pelo site). O nome do arquivo já carrega as informações principais:

```
austral_aftermovie_h.mp4
  │          │       │
  │          │       └── orientação: h = horizontal (16:9)
  │          └────────── tipo: aftermovie
  └───────────────────── cliente: Austral
```

O robô lê o nome e já sabe cliente, tipo de vídeo e formato — sem precisar de mais nada.

---

### ② Análise com IA
O robô extrai **6 fotos** (frames) espalhadas pelo vídeo e as mostra para o Claude (a IA da Anthropic — mesma empresa que faz o ChatGPT concorrente). O Claude olha essas fotos e decide:

- **Onde publicar:** Instagram Reels? YouTube? TikTok? LinkedIn? (depende do formato e do cliente)
- **Tom da mensagem:** industrial e sério para B2B (Austral, Metroval), mais leve para outros
- **Se é conteúdo de IA:** vídeos gerados por IA recebem uma marcação obrigatória nas redes

---

### ③ Geração de copy (legendas)
O mesmo Claude escreve **uma legenda diferente para cada rede**, respeitando o tom da Swell: premium, cinematográfico, direto, sem clichê de marketing.

Depois passa por um segundo agente que **avalia a qualidade de 0 a 10** e reescreve se a nota for baixa. Só segue em frente quando a legenda está boa.

Um terceiro agente escolhe o **melhor horário de publicação** para cada rede (baseado em dados de engajamento), para que os posts não saiam todos ao mesmo tempo.

---

### ④ Aprovação no Notion
O robô cria uma linha no banco de dados do Notion com:

- Miniatura do vídeo (thumbnail escolhida pela IA)
- Legenda de cada rede
- Horário sugerido de publicação
- Status: **Aguardando aprovação**

**Você ou a Isa** abrem o Notion, leem, editam a legenda se quiser, preenchem a data/hora de publicação e mudam o status para **Aprovado**.

> Nada é publicado sem essa aprovação. É uma regra inegociável.

---

### ⑤ Publicação automática
A cada 15 minutos um relógio verifica se tem algum post aprovado com horário chegando. Quando chega a hora, o robô publica em **todas as redes de uma só vez** através de um serviço chamado Zernio — sem precisar entrar em cada rede manualmente.

As redes que recebem o post dependem do tipo de vídeo:

| Tipo de vídeo | Redes |
|---------------|-------|
| Vertical curto (Reels, bastidor) | Instagram, TikTok, YouTube Shorts |
| Horizontal (aftermovie, institucional) | YouTube, LinkedIn |
| Cliente B2B industrial | Prioriza LinkedIn e YouTube |

---

### ⑥ Registro
Após a publicação, o Notion é atualizado com os links de cada post e o status muda para **Publicado**. Vira um histórico completo de tudo que foi ao ar.

---

## O site (painel web)

Além do robô de linha de comando, existe um **site interno** acessível em https://swell.mermaid.video com:

- **Upload de vídeos** direto pelo navegador (sem precisar de pasta no computador)
- **Lista de posts** com status de cada um
- **Área de admin** para gerenciar empresas/clientes
- **Configurações** de contas das redes sociais

---

## Onde cada coisa fica guardada

| O quê | Onde |
|-------|------|
| Os vídeos | Cloudflare R2 (nuvem — link público para as redes baixarem) |
| As legendas e aprovações | Notion |
| Histórico e dados do sistema | Banco de dados Neon (nuvem) |
| O site | Vercel (hospedagem web) |
| O robô de publicação | Railway (servidor que fica ligado 24h) |

---

## O que o robô NÃO faz

- ❌ **Não publica sem sua aprovação** — nunca
- ❌ **Não inventa credenciais das redes** — a conexão com Instagram, TikTok etc. é feita uma vez pelo Swell no painel do Zernio
- ❌ **Não acessa dados de clientes além do necessário** — só lê o nome do arquivo e os frames do vídeo
- ❌ **Não apaga vídeos do YouTube** — uma vez que sobe, fica lá (limitação do YouTube)

---

## Glossário rápido

| Termo | O que é |
|-------|---------|
| **IA / Claude** | Inteligência artificial que lê imagens e escreve texto |
| **Frame** | Uma foto tirada de um momento do vídeo |
| **Copy / Legenda** | O texto que aparece junto com o post nas redes |
| **Notion** | Ferramenta de notas/banco de dados onde fica a fila de aprovação |
| **R2** | Serviço de armazenamento de arquivos na nuvem (da Cloudflare) |
| **Zernio** | Serviço que publica em todas as redes com uma só chamada |
| **Worker** | Servidor que fica rodando em segundo plano verificando tarefas |
| **Cron** | Relógio automático que dispara tarefas em horários definidos |

---

*Documento gerado em junho de 2026. Atualizar sempre que uma nova fase for concluída.*
