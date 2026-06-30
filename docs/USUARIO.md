# Bem-vindo ao Swell Mermaid

Esse é o manual pra quem vai usar o app no dia a dia — sem termos técnicos. Se travar em algo, fala com a gente: **filmesswell@gmail.com**.

---

## Primeiro acesso (onboarding)

### 1. Aceitar o convite

Você vai receber um link por email com algo tipo "Você foi convidado pro Swell Mermaid". Clica nele. O link já te leva pra tela de cadastro com sua empresa pré-vinculada.

### 2. Criar seu login

Clica em **Entrar com Google** (recomendado, mais rápido) ou cria com email + senha. Usa o **mesmo email** que recebeu o convite.

Depois do cadastro, você cai direto no painel.

### 3. Conectar o Notion

Vai em **Configurações → Notion**. Clica em **Conectar Notion**.

O Notion vai pedir pra você escolher um workspace (a conta) e autorizar o app. **Não precisa criar banco nem coluna nenhuma** — o Swell Mermaid faz isso sozinho na primeira conexão. Em ~10 segundos volta dizendo "Notion conectado · Base criada".

Esse banco criado vai ser a sua fila de aprovação. Você pode abrir o Notion separado pra acompanhar.

### 4. Conectar as redes sociais

Vai em **Configurações → Redes**. Pra cada rede que você quer publicar (Instagram, YouTube, TikTok, LinkedIn), clica em **Conectar**.

Abre o painel do Zernio (parceiro que cuida das publicações). Você loga na rede direto lá — Instagram pede sua conta business, YouTube pede o canal, e por aí vai. Quando terminar, fecha a aba e volta — a tela de Configurações já mostra **Conectado** com o nome da conta.

> Se você só conectar 2 redes (digamos Instagram + YouTube), os posts só vão pra essas. As outras ficam ignoradas.

---

## Subir um vídeo

Vai em **Subir vídeo** no menu lateral. Arrasta o arquivo na área pontilhada (ou clica pra escolher).

### Nome do arquivo

Use a convenção:

```
[cliente]_[tipo]_[orientacao].mp4

exemplos:
  austral_aftermovie_h.mp4
  metroval_reel_v.mp4
  becogelato_ai_v.mp4
```

- **cliente**: nome curto sem acentos (austral, metroval, alcon…)
- **tipo**: aftermovie, reel, bastidor, institucional, minidoc, ai
- **orientacao**: `h` (16:9 horizontal) ou `v` (9:16 vertical)

Se o nome estiver fora do padrão, sem problema — a IA tenta adivinhar. Mas com o nome certo, tudo é mais rápido e sem ambiguidade.

### Formatos aceitos

MP4, MOV, WEBM. Até **5 GB** por arquivo.

### Vários de uma vez

Pode soltar vários arquivos juntos. Cada um vira um card independente.

---

## Acompanhar o processamento

Depois que você solta o vídeo:

1. **Card de upload** — aparece em cima com a barra de progresso. Em alguns segundos vira "Enfileirado".
2. **Processando** — a IA está vendo os frames, escrevendo a copy, escolhendo thumbnail. Demora 30–90s por vídeo.
3. **Pronto** — vai pra fila de aprovação. Link de "Ver na tabela" leva pra lá.

No **Dashboard** você acompanha em tempo real os últimos uploads e o status.

---

## Aprovar um post

Vai em **Posts** (ou abre direto a tabela do Notion).

Clica num post com status **Aguardando**. Abre um drawer (painel lateral) com:

- **Thumbnail** escolhida pela IA
- **Copy de cada rede** (Instagram, YouTube, TikTok, LinkedIn) em abas separadas
- **Data de publicação** sugerida (você pode mudar)
- **Redes** que vão receber (você pode desmarcar)

### Editar a copy

Clica no texto. Edita à vontade. Salva. A copy editada vence a original na hora de publicar.

### Editar a data

Pode escolher qualquer data/hora futura. Se você **deixar em branco** e marcar Aprovado, publica na hora (imediato).

Se você marcar Aprovado com data **no passado**, publica imediato também (não tem como agendar pra trás).

### Editar as redes

Desmarca a rede que não quer. Útil quando uma copy específica não ficou boa pra TikTok mas tá ótima pro Instagram, por exemplo.

### Aprovar ou Rejeitar

- **Aprovar**: vai pra fila do agendador. No próximo ciclo de 5 minutos, o robô agenda no Zernio.
- **Rejeitar**: post vai pra status **Rejeitado** e não publica nunca. Você pode reativar depois se mudar de ideia.

---

## Quando o post fica "Publicado"

Status vai mudando assim:

```
Aguardando → Aprovado → Agendado → Publicando → Publicado
```

- **Agendado**: tá no Zernio com hora marcada.
- **Publicando**: chegou a hora e o robô está enviando pra cada rede.
- **Publicado**: tudo deu certo. Aparecem os links de cada rede no card.

Se uma rede falhar (ex: Instagram pediu thumbnail e não tinha), o status vai pra **Parcial**: o resto publicou, só aquela falhou.

---

## Editar copy depois que o plano já foi aprovado

Pode editar tanto no **app** quanto direto no **Notion**. Ambos sincronizam.

Regra: **a edição mais recente ganha**. Se você edita no Notion 10 minutos antes de publicar, vale o do Notion. Se você edita no app 5 minutos antes, vale o do app.

Edições só valem até o **cutoff do Zernio** (cerca de 10 minutos antes do horário marcado). Depois disso, o post já saiu da fila do Zernio e qualquer edição não pega mais.

---

## Reprocessar um erro

Se uma rede falhou (status **Parcial** ou **Falhou**):

1. Abre o post no drawer.
2. Botão **Tentar de novo** (só nas redes que falharam).
3. Reagenda pra publicar nas próximas horas.

Se o erro foi por causa de conta desconectada, reconecta a rede em **Configurações → Redes** primeiro.

---

## FAQ

**E se eu errar a data?**
Pode editar até a publicação acontecer. Abre o drawer, muda a data, salva.

**Posso aprovar sem data?**
Sim. Marca Aprovado sem preencher data — publica na hora.

**E se eu desconectar uma rede?**
Posts já agendados pra aquela rede ficam ignorados (não publica). Posts novos não incluem essa rede. Os outros posts em outras redes seguem normais.

**Quem vê o que?**
Multi-empresa. Cada empresa só vê os próprios posts, próprio Notion, próprio R2. Ninguém de outra empresa vê nada seu.

**Por que o YouTube publicou na hora se eu agendei pro mês que vem?**
O YouTube não aceita agendamento via API — o vídeo sobe pro YouTube imediato, mas fica como **privado/oculto** até o horário marcado. É comportamento do YouTube, não bug do Swell.

**Por que o Instagram pediu thumbnail?**
Algumas postagens do Instagram (Reels) precisam de thumbnail customizada. A IA escolhe uma do vídeo automaticamente. Se a escolhida não ficar boa, abre o drawer e troca pela coluna **ThumbnailUrl** no Notion (cola uma URL de imagem qualquer).

**Posso apagar um vídeo do YouTube depois de publicado?**
Não pelo app. O YouTube guarda o vídeo lá pra sempre — você precisa entrar no Studio do YouTube e apagar manualmente.

**Tem suporte?**
Email: **filmesswell@gmail.com**. Resposta no mesmo dia útil.
