# SETUP-F2-4 — Upload de vídeo pelo browser

> Esta fase entrega: você arrasta um vídeo no `/app/upload`, ele sobe direto pro
> R2, o worker analisa com Claude e cria a linha aguardando aprovação no Notion.

## Divisão de trabalho

- **VOCÊ faz:** rodar 1 comando pra configurar CORS no R2, e deixar o worker rodando.
- **Claude já fez:** todo o código (UI, APIs, worker).

## Passo 1 — Configura CORS no R2 (uma vez só)

O browser precisa de permissão pra mandar PUT direto no bucket R2. Sem isso, o
upload falha com erro CORS.

No terminal:

```sh
npm run r2:setup-cors
```

Esperado:
```
Configurando CORS no bucket "mermaid"...
✅ CORS configurado pra:
   - http://localhost:3000
   - http://localhost:4488
   - ...
```

## Passo 2 — Rodar o worker em OUTRO terminal

O worker é um processo Node separado que fica esperando jobs novos no banco.
Sem ele rodando, o upload sobe pro R2 normalmente mas fica "Enfileirado" pra
sempre.

Em **um novo terminal** (deixa o `npm run dev` rodando no outro):

```sh
cd "/Users/joaocosta/Documents/PROJETOS_CLAUDE/MERMAID AGENT SWELL"
npm run worker
```

Esperado:
```
[hh:mm:ss] [worker -] [boot] worker subiu. polling a cada 5s...
```

Deixa esse terminal aberto. Quando você subir um vídeo pelo app, vai ver os
logs aparecendo aqui (`[worker #42] [ingest] ⬇️  baixando...` etc.).

## Passo 3 — Testa o upload no navegador

1. Abre **http://localhost:4488/app/upload**
2. Arrasta um vídeo (ou clica pra escolher) — MP4/MOV/WEBM
3. Acompanha a barra de progresso (upload pro R2)
4. Status muda pra "Enfileirado" → "Processando" → "✅ Pronto"
5. Clica em **Ver na tabela ↓** pra confirmar que apareceu

Tempo típico: ~5-15s de upload (depende do tamanho), 30-90s de processamento.

## Como funciona por baixo

```
Browser              Next.js               R2              Postgres           Worker
   │                    │                   │                  │                │
   ├─ POST /api/upload/url ─►                                                    
   │◄── { url assinada }─┤                                                       
   ├─ PUT direto no R2 ──────────────────►  │                                    
   │                                        │                                    
   ├─ POST /api/jobs ──►                                                         
   │                    ├─ INSERT job ─────────────────────►   │                
   │◄── { jobId } ──────┤                                                        
   │                                                            │                
   │ (poll GET /api/jobs/:id a cada 3s)                         │                
   │                                                            │                
   │                                                            ◄─ SELECT pending
   │                                                            │ (a cada 5s)    
   │                                                            ├─ baixa do R2   
   │                                                            ├─ ffmpeg frames 
   │                                                            ├─ Claude cérebro
   │                                                            ├─ Notion line   
   │                                                            ├─ UPDATE done   
   │                                                            │                
   │◄── { status: done, pageId } ─────────  ◄──────────────────  │                
```

## Quando isso vai funcionar SEM você manter o worker rodando

Na **F2.6** o worker e os 3 crons antigos vão pro Railway. Aí você pode fechar
o Mac e o upload continua processando.

## Se algo der errado

- **"CORS error" no console do browser** → você esqueceu o `npm run r2:setup-cors`.
- **Job fica "Enfileirado" pra sempre** → o worker não está rodando. Abre o outro terminal e roda `npm run worker`.
- **Worker dá `ffprobe: command not found`** → você precisa instalar ffmpeg (`brew install ffmpeg`). Mas se a CLI já funciona, você já tem.
- **"Não autenticado" na API** → cookie de sessão expirou; faz login de novo.
- **R2 retorna 403 no PUT** → o `R2_ACCESS_KEY_ID` no `.env` precisa ter permissão de write no bucket.

## O que NÃO faz ainda

- ❌ Não corta vídeo vertical automaticamente
- ❌ Não dá pra subir vários de uma vez (V1 é um por um)
- ❌ Não tem deletar arquivo do R2 se der erro
- ❌ Worker roda no seu Mac ainda (F2.6 migra)

Próxima fase, **F2.6**, leva worker + crons pro Railway e desliga o `launchd`.
Depois disso, Mac pode ficar off.
