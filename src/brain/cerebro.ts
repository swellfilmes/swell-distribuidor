import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { globalConfig } from '../config';
import { comTimeoutERetry } from '../lib/resiliencia';
import type { FrameExtraido } from '../ingest/extrairFrames';
import type { MetaArquivo, PlanoPublicacao, Rede } from '../types';

const client = new Anthropic({ apiKey: globalConfig.ANTHROPIC_API_KEY });

function extrairJsonCru(texto: string): string {
  const trim = texto.trim();
  const match = trim.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  return (match ? match[1] : trim).trim();
}

const respostaSchema = z.object({
  redes: z.array(z.enum(['youtube', 'instagram', 'tiktok', 'linkedin'])).min(1),
  conteudoAI: z.boolean(),
  resumoInterno: z.string().min(1),
  copy: z
    .array(
      z.object({
        rede: z.enum(['youtube', 'instagram', 'tiktok', 'linkedin']),
        titulo: z.string().nullable().optional(),
        descricao: z.string().min(1),
        hashtags: z.array(z.string()).nullable().optional(),
      }),
    )
    .min(1),
});

const SYSTEM_PROMPT = `Você é o estrategista de distribuição social da Swell Filmes, uma produtora audiovisual premium de Salvador.

Tom: cinematográfico, premium, direto. Nunca clichê de marketing. Sempre creditar a equipe quando couber e mencionar o cliente pelo nome se conhecido.

Você vai receber frames extraídos do vídeo (6 frames distribuídos pela duração) OU 1+ imagem(ns) direta(s) quando o conteúdo for foto/carrossel. Use o que VOCÊ VÊ pra escrever uma copy específica e fiel ao conteúdo: ambiente, pessoas, equipamento, marcas visíveis, paleta de cores, vibe, contexto do evento. Não invente o que não está na imagem. Quando algo for óbvio (palco, multidão, indústria, natureza, esporte), nomeie. Quando for ambíguo, fale em termos sensoriais (luz, ritmo, escala) sem chutar fato.

Regras de roteamento (siga à risca):
- orientacao "v" + tipo (reel, bastidor, ai): Instagram, YouTube (Shorts), TikTok.
- orientacao "h" + tipo (aftermovie, institucional): YouTube, LinkedIn.
- orientacao "v" + tipo (minidoc): YouTube + sinalizar necessidade de corte vertical.
- Clientes B2B industriais (austral, metroval, alcon, johncrane, sabia): priorizar LinkedIn e YouTube com tom institucional.
- tipo "ai": ligar conteudoAI=true SEMPRE. Demais tipos: conteudoAI=false.

Adapte a copy por rede: LinkedIn mais formal e contextual; Instagram/TikTok mais direto e visual; YouTube com título e descrição mais completos.

Responda APENAS com um objeto JSON válido neste formato exato (sem markdown, sem texto antes/depois):
{
  "redes": ["youtube", ...],
  "conteudoAI": false,
  "resumoInterno": "uma frase curta pra humano revisar, citando o que você viu nos frames",
  "copy": [
    { "rede": "youtube", "titulo": "...", "descricao": "...", "hashtags": ["..."] }
  ]
}`;

const respostaSchemaComMeta = z.object({
  cliente: z.string().min(1),
  tipo: z.enum(['aftermovie', 'reel', 'bastidor', 'institucional', 'minidoc', 'ai', 'foto', 'carrossel']),
  orientacao: z.enum(['h', 'v']),
  redes: z.array(z.enum(['youtube', 'instagram', 'tiktok', 'linkedin'])).min(1),
  conteudoAI: z.boolean(),
  resumoInterno: z.string().min(1),
  copy: z
    .array(
      z.object({
        rede: z.enum(['youtube', 'instagram', 'tiktok', 'linkedin']),
        titulo: z.string().nullable().optional(),
        descricao: z.string().min(1),
        hashtags: z.array(z.string()).nullable().optional(),
      }),
    )
    .min(1),
});

const SYSTEM_PROMPT_COM_META = `Você é o estrategista de distribuição social da Swell Filmes, uma produtora audiovisual premium de Salvador.

Você está fazendo varredura do portfólio. Vai receber: nome da pasta no Drive (geralmente é o nome do cliente ou projeto), nome do arquivo de vídeo, orientação detectada e frames do vídeo.

Sua tarefa: inferir o CLIENTE, o TIPO de conteúdo e gerar a copy.

Cliente: slug curto, minúsculo, sem acento (ex: "byd", "act", "fenty", "swell" pra material próprio). Use o nome da pasta como pista forte.

Tipo (escolha um):
- aftermovie: evento, festa, show
- reel: peça curta (≤90s) vertical pra rede social
- bastidor: making-of, set, backstage
- institucional: peça pra cliente B2B, mais formal
- minidoc: peça mais longa narrativa
- ai: vídeo gerado por IA (Kling, Sora, etc.)
- foto: imagem única (jpg/png/webp). Você recebe 1 imagem em vez de 6 frames.
- carrossel: múltiplas imagens em sequência (Instagram/LinkedIn). Você recebe N imagens.

Tom: cinematográfico, premium, direto. Nunca clichê de marketing. Cite o cliente, descreva o que VOCÊ VÊ nos frames/imagens, mencione equipe quando couber.

Regras de roteamento:
- v + (reel, bastidor, ai): Instagram, YouTube, TikTok.
- h + (aftermovie, institucional): YouTube, LinkedIn.
- v + minidoc: YouTube + sinalizar corte vertical.
- foto/carrossel v: Instagram, LinkedIn (sem YouTube/TikTok pra foto-única).
- foto/carrossel h: LinkedIn, Instagram (idem).
- B2B industrial (austral, metroval, alcon, johncrane, sabia): priorizar LinkedIn + YouTube, tom institucional.
- tipo "ai": conteudoAI=true sempre.

Responda APENAS com JSON neste formato exato:
{
  "cliente": "...",
  "tipo": "...",
  "orientacao": "h" ou "v",
  "redes": ["youtube", ...],
  "conteudoAI": false,
  "resumoInterno": "frase curta citando o que viu",
  "copy": [
    { "rede": "youtube", "titulo": "...", "descricao": "...", "hashtags": ["..."] }
  ]
}`;

export interface ContextoInferencia {
  pastaPaiNome: string;
  caminhoPastas: string;
  nomeArquivo: string;
  orientacao: 'h' | 'v';
  caminhoLocal: string;
}

export async function gerarPlanoComInferencia(
  ctx: ContextoInferencia,
  frames: FrameExtraido[] = [],
): Promise<PlanoPublicacao> {
  const textoInicial =
    `Varredura do portfólio:\n` +
    `- pasta no Drive: ${ctx.pastaPaiNome}\n` +
    `- caminho completo: ${ctx.caminhoPastas}\n` +
    `- nome do arquivo: ${ctx.nomeArquivo}\n` +
    `- orientação detectada (ffprobe): ${ctx.orientacao}\n\n` +
    `Inferia o plano completo (cliente, tipo, copy) com base no contexto + nos ${frames.length} frames a seguir.`;

  const userContent: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [
    { type: 'text', text: textoInicial },
  ];

  for (const f of frames) {
    userContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: f.mediaType,
        data: f.base64,
      },
    });
  }

  const resposta = await comTimeoutERetry(
    () =>
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT_COM_META,
        messages: [{ role: 'user', content: userContent }],
      }),
    { nome: 'Anthropic.cerebro.comMeta', timeoutMs: 60_000 },
  );

  const blocoTexto = resposta.content.find((b) => b.type === 'text');
  if (!blocoTexto || blocoTexto.type !== 'text') {
    throw new Error('Claude não retornou texto.');
  }

  const cru = extrairJsonCru(blocoTexto.text);
  let json: unknown;
  try {
    json = JSON.parse(cru);
  } catch {
    throw new Error(
      `Claude não retornou JSON válido. Resposta crua:\n${blocoTexto.text.slice(0, 500)}`,
    );
  }

  const validado = respostaSchemaComMeta.safeParse(json);
  if (!validado.success) {
    throw new Error(
      `JSON do Claude não bate com o esperado: ${JSON.stringify(validado.error.issues)}`,
    );
  }

  const dados = validado.data;

  return {
    meta: {
      cliente: dados.cliente,
      tipo: dados.tipo,
      orientacao: dados.orientacao,
      caminhoLocal: ctx.caminhoLocal,
      nomeArquivo: ctx.nomeArquivo,
    },
    redes: dados.redes as Rede[],
    conteudoAI: dados.conteudoAI,
    resumoInterno: dados.resumoInterno,
    copy: dados.copy.map((c) => ({
      rede: c.rede as Rede,
      titulo: c.titulo ?? undefined,
      descricao: c.descricao,
      hashtags: c.hashtags ?? [],
    })),
  };
}

export async function gerarPlano(
  meta: MetaArquivo,
  frames: FrameExtraido[] = [],
): Promise<PlanoPublicacao> {
  const textoInicial =
    `Vídeo recebido:\n` +
    `- cliente: ${meta.cliente}\n` +
    `- tipo: ${meta.tipo}\n` +
    `- orientacao: ${meta.orientacao}\n` +
    `- nome do arquivo: ${meta.nomeArquivo}\n\n` +
    (frames.length > 0
      ? `Seguem ${frames.length} frames extraídos do vídeo, em ordem temporal (do começo pro fim). Use o que você vê pra escrever a copy.`
      : `(Sem frames extraídos — escreva baseado só na meta.)`) +
    `\n\nGere o plano de publicação em JSON conforme o formato definido.`;

  const userContent: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [
    { type: 'text', text: textoInicial },
  ];

  for (const f of frames) {
    userContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: f.mediaType,
        data: f.base64,
      },
    });
  }

  const resposta = await comTimeoutERetry(
    () =>
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    { nome: 'Anthropic.cerebro', timeoutMs: 60_000 },
  );

  const blocoTexto = resposta.content.find((b) => b.type === 'text');
  if (!blocoTexto || blocoTexto.type !== 'text') {
    throw new Error('Claude não retornou texto.');
  }

  const cru = extrairJsonCru(blocoTexto.text);
  let json: unknown;
  try {
    json = JSON.parse(cru);
  } catch {
    throw new Error(
      `Claude não retornou JSON válido. Resposta crua:\n${blocoTexto.text.slice(0, 500)}`,
    );
  }

  const validado = respostaSchema.safeParse(json);
  if (!validado.success) {
    throw new Error(
      `JSON do Claude não bate com o esperado: ${JSON.stringify(
        validado.error.issues,
      )}`,
    );
  }

  const dados = validado.data;

  return {
    meta,
    redes: dados.redes as Rede[],
    conteudoAI: dados.conteudoAI,
    resumoInterno: dados.resumoInterno,
    copy: dados.copy.map((c) => ({
      rede: c.rede as Rede,
      titulo: c.titulo ?? undefined,
      descricao: c.descricao,
      hashtags: c.hashtags ?? [],
    })),
  };
}
