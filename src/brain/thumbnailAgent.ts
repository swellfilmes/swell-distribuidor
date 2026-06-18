import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { globalConfig } from '../config';
import type { FrameExtraido } from '../ingest/extrairFrames';
import type { PlanoPublicacao } from '../types';

const client = new Anthropic({ apiKey: globalConfig.ANTHROPIC_API_KEY });

function extrairJsonCru(texto: string): string {
  const trim = texto.trim();
  const match = trim.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  return (match ? match[1] : trim).trim();
}

const respostaSchema = z.object({
  avaliacoes: z
    .array(
      z.object({
        indice: z.number().int().min(0),
        nota: z.number().min(0).max(10),
        comentario: z.string(),
      }),
    )
    .min(1),
  melhorIndice: z.number().int().min(0),
  scoreMelhor: z.number().min(0).max(10),
  justificativa: z.string(),
  precisaMaisFrames: z.boolean(),
});

export interface ResultadoThumbnail {
  melhorIndice: number;
  scoreMelhor: number;
  justificativa: string;
  precisaMaisFrames: boolean;
  avaliacoes: Array<{ indice: number; nota: number; comentario: string }>;
}

const SYSTEM_PROMPT = `Você é um diretor de arte especialista em THUMBNAILS DE REDES SOCIAIS. Sua função: olhar uma sequência de frames extraídos de um vídeo e dizer qual seria a melhor THUMBNAIL/CAPA pra prender o scroll.

CRITÉRIOS DE THUMBNAIL FORTE (avalie 0-10 cada frame):
1. **Foco visual claro** — o sujeito/ação principal está nítido, no centro de atenção, sem distração.
2. **Composição** — regra dos terços, ponto focal definido, simetria ou tensão visual.
3. **Cor e contraste** — cores vibrantes ou contraste alto que destacam do feed cinza.
4. **Expressão humana** — rostos com emoção genuína são THE thumbnail mais forte (especialmente surpresa, riso, intensidade).
5. **Espaço pra texto** — área limpa onde dá pra sobrepor título (importante pra YouTube).
6. **Ação capturada no auge** — não pé do salto nem aterrissagem, mas o pico da ação.
7. **Anti-thumb**: rejeitar transições escuras, frames borrados (motion blur), close em logo/texto puro, frame com tudo igualmente importante (sem hierarquia), pessoa de costas sem contexto, frame da intro/outro.

Critério final pra "thumbnail aprovada": **score >= 7**. Abaixo disso, sinalize precisaMaisFrames=true.

Contexto vai te ajudar a entender o tom desejado (cliente, tipo, redes-alvo). Cliente B2B (LinkedIn dominante) pede thumbnail mais sóbria. Consumer (IG/TikTok) pode ser mais energética.

Responda APENAS com JSON no formato:
{
  "avaliacoes": [
    { "indice": 0, "nota": 6, "comentario": "frame da intro, fade preto, baixa atenção" },
    { "indice": 1, "nota": 8, "comentario": "close no palestrante apontando, contraste azul/branco, ótimo pra YT" },
    ...
  ],
  "melhorIndice": 1,
  "scoreMelhor": 8,
  "justificativa": "frase curta",
  "precisaMaisFrames": false
}`;

export async function avaliarFramesParaThumbnail(
  plano: PlanoPublicacao,
  frames: FrameExtraido[],
): Promise<ResultadoThumbnail> {
  const contextoTexto =
    `Cliente: ${plano.meta.cliente}\n` +
    `Tipo de vídeo: ${plano.meta.tipo}\n` +
    `Orientação: ${plano.meta.orientacao}\n` +
    `Redes-alvo: ${plano.redes.join(', ')}\n` +
    `Resumo visual: ${plano.resumoInterno}\n\n` +
    `Te mando ${frames.length} frames numerados de 0 a ${frames.length - 1}. ` +
    `Avalie cada um, escolha o melhor pra thumbnail. ` +
    `Se nenhum frame passar de score 7, sinalize precisaMaisFrames=true. ` +
    `Responda em JSON conforme instruído.`;

  const userContent: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [
    { type: 'text', text: contextoTexto },
  ];
  for (const f of frames) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: f.mediaType, data: f.base64 },
    });
  }

  const resposta = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const blocoTexto = resposta.content.find((b) => b.type === 'text');
  if (!blocoTexto || blocoTexto.type !== 'text') {
    throw new Error('Agente de thumbnail não retornou texto.');
  }

  const cru = extrairJsonCru(blocoTexto.text);
  let json: unknown;
  try {
    json = JSON.parse(cru);
  } catch {
    throw new Error(
      `Agente de thumbnail não retornou JSON válido. Resposta crua:\n${blocoTexto.text.slice(0, 500)}`,
    );
  }

  const validado = respostaSchema.safeParse(json);
  if (!validado.success) {
    throw new Error(
      `JSON do agente de thumbnail não bate com o esperado: ${JSON.stringify(validado.error.issues)}`,
    );
  }

  return {
    melhorIndice: validado.data.melhorIndice,
    scoreMelhor: validado.data.scoreMelhor,
    justificativa: validado.data.justificativa,
    precisaMaisFrames: validado.data.precisaMaisFrames,
    avaliacoes: validado.data.avaliacoes,
  };
}
