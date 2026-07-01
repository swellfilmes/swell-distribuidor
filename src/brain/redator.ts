import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { globalConfig } from '../config';
import { comTimeoutERetry } from '../lib/resiliencia';
import { TOM_DE_VOZ_SWELL } from './tomSwell';
import type { FrameExtraido } from '../ingest/extrairFrames';
import type { CopyPorRede, PlanoPublicacao, Rede } from '../types';

const client = new Anthropic({ apiKey: globalConfig.ANTHROPIC_API_KEY });

function extrairJsonCru(texto: string): string {
  const trim = texto.trim();
  const match = trim.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  return (match ? match[1] : trim).trim();
}

const respostaSchema = z.object({
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

function buildSystemPrompt(tomVoz?: string): string {
  const tom = tomVoz?.trim() || TOM_DE_VOZ_SWELL;
  return `${tom}

---

Você é o redator especialista da marca. Outra IA escreveu uma copy bruta pra publicar um vídeo em redes sociais. Sua função: reescrever cada caption seguindo o guia de tom acima.

REGRAS:
- Mantenha o array de redes igual (mesma ordem, mesma quantidade).
- Pra cada rede, REESCREVA a descrição completamente. Não copie estrutura nem frases da copy bruta.
- Aplique a fórmula GANCHO → DESENVOLVIMENTO → FECHAMENTO.
- Diferencie por rede: LinkedIn pode desenvolver mais (autoridade B2B), Instagram/TikTok mais conciso e visual, YouTube com título cuidadoso (max 100 chars) e descrição mais completa.
- Hashtags: máximo 5 por rede, evite clichês ("#aftermovie #produtoraaudiovisual"), prefira específicas ao cliente/setor.
- Use o que você vê nos frames pra ancorar a copy em algo concreto.
- Quando fornecida, use a transcrição do áudio pra ancorar a copy no que realmente foi dito no vídeo — depoimentos, narração, entrevistas.
- Nunca use frases genéricas de auto-promoção ("entregamos", "produzimos com carinho", "foi incrível"). Nunca use exclamação forçada.
- O resumoInterno fica como está (não toca).
- PROIBIDO usar traço em (—) ou traço médio (–) dentro da legenda como separador visual entre frases ou blocos. Separe parágrafos apenas com quebra de linha (\n). Frases independentes ficam em parágrafos próprios, nunca ligadas por traço.

Responda APENAS com JSON nesse formato:
{
  "copy": [
    { "rede": "youtube", "titulo": "...", "descricao": "...", "hashtags": ["...", "..."] },
    ...
  ]
}`;
}

export async function polirCopy(
  plano: PlanoPublicacao,
  frames: FrameExtraido[] = [],
  tomVoz?: string,
  transcricao?: { texto: string } | null,
): Promise<PlanoPublicacao> {
  const copyBrutaResumo = plano.copy
    .map((c) => {
      const titulo = c.titulo ? `\n  Título: ${c.titulo}` : '';
      const hashtags = c.hashtags.length ? `\n  Hashtags: ${c.hashtags.join(', ')}` : '';
      return `- ${c.rede.toUpperCase()}:${titulo}\n  Descrição: ${c.descricao}${hashtags}`;
    })
    .join('\n\n');

  const textoTranscricao = transcricao?.texto?.trim()
    ? `\nTranscrição do áudio do vídeo:\n"""\n${transcricao.texto.trim()}\n"""\n`
    : '';

  const textoInicial =
    `Cliente: ${plano.meta.cliente}\n` +
    `Tipo: ${plano.meta.tipo}\n` +
    `Orientação: ${plano.meta.orientacao}\n` +
    `Resumo visual: ${plano.resumoInterno}\n` +
    textoTranscricao +
    `\nCopy BRUTA a reescrever:\n${copyBrutaResumo}\n\n` +
    `Reescreva cada descrição seguindo o tom da marca. Responda em JSON conforme instruído.`;

  const userContent: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [
    { type: 'text', text: textoInicial },
  ];
  for (const f of frames) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: f.mediaType, data: f.base64 },
    });
  }

  const resposta = await comTimeoutERetry(
    () =>
      client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 2048,
        system: buildSystemPrompt(tomVoz),
        messages: [{ role: 'user', content: userContent }],
      }),
    { nome: 'Anthropic.redator', timeoutMs: 60_000 },
  );

  const blocoTexto = resposta.content.find((b) => b.type === 'text');
  if (!blocoTexto || blocoTexto.type !== 'text') {
    throw new Error('Redator não retornou texto.');
  }

  const cru = extrairJsonCru(blocoTexto.text);
  let json: unknown;
  try {
    json = JSON.parse(cru);
  } catch {
    throw new Error(
      `Redator não retornou JSON válido. Resposta crua:\n${blocoTexto.text.slice(0, 500)}`,
    );
  }

  const validado = respostaSchema.safeParse(json);
  if (!validado.success) {
    throw new Error(
      `JSON do redator não bate com o esperado: ${JSON.stringify(validado.error.issues)}`,
    );
  }

  const novaCopy: CopyPorRede[] = validado.data.copy.map((c) => ({
    rede: c.rede as Rede,
    titulo: c.titulo ?? undefined,
    descricao: c.descricao,
    hashtags: c.hashtags ?? [],
  }));

  return { ...plano, copy: novaCopy };
}
