import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { globalConfig } from '../config';
import { comTimeoutERetry } from '../lib/resiliencia';
import { TOM_DE_VOZ_SWELL } from './tomSwell';
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
        notaAntes: z.number().min(0).max(10),
        notaDepois: z.number().min(0).max(10),
        justificativa: z.string(),
        titulo: z.string().nullable().optional(),
        descricao: z.string().min(1),
        hashtags: z.array(z.string()).nullable().optional(),
      }),
    )
    .min(1),
});

export interface AvaliacaoCopy {
  rede: Rede;
  notaAntes: number;
  notaDepois: number;
  justificativa: string;
}

export interface ResultadoAvaliacao {
  planoMelhorado: PlanoPublicacao;
  avaliacoes: AvaliacaoCopy[];
}

const SYSTEM_PROMPT = `${TOM_DE_VOZ_SWELL}

---

Você é o AVALIADOR-CORRETOR de captions da Swell. Vou te passar uma copy já feita por outro redator. Sua função:

1. PONTUAR cada caption de 0 a 10 considerando:
   - Aderência ao tom Swell (vocabulário, estrutura, postura).
   - Capacidade de PARAR O SCROLL: o gancho prende? A frase é forte? Não tem cara de IA?
   - Clareza, ritmo, ausência de jargão.
   - Diferenciação por rede (LinkedIn ≠ TikTok).

2. Se a nota for menor que 10, REESCREVA a caption pra ficar 10. Aplique a fórmula gancho → desenvolvimento → fechamento. Use vocabulário do guia. Não suavize: se a copy é fraca, refaça do zero.

3. Justifique brevemente em 1-2 frases o que estava errado e o que mudou.

4. Mantenha:
   - O array de redes (mesma ordem, mesma quantidade).
   - Hashtags: máximo 5 por rede, sem clichê.
   - Título do YouTube: max 100 chars.

5. Se a nota for 10 (já está perfeita), repete a caption como está, score depois = 10.

Responda APENAS com JSON nesse formato:
{
  "copy": [
    {
      "rede": "youtube",
      "notaAntes": 7,
      "notaDepois": 10,
      "justificativa": "Gancho era apresentação; troquei por afirmação provocativa. Removi 'foi incrível'.",
      "titulo": "...",
      "descricao": "...",
      "hashtags": ["...", "..."]
    },
    ...
  ]
}`;

export async function avaliarECorrigir(
  plano: PlanoPublicacao,
): Promise<ResultadoAvaliacao> {
  const copyResumo = plano.copy
    .map((c) => {
      const titulo = c.titulo ? `\n  Título: ${c.titulo}` : '';
      const hashtags = c.hashtags.length ? `\n  Hashtags: ${c.hashtags.join(', ')}` : '';
      return `- ${c.rede.toUpperCase()}:${titulo}\n  Descrição: ${c.descricao}${hashtags}`;
    })
    .join('\n\n');

  const userMessage =
    `Cliente: ${plano.meta.cliente}\n` +
    `Tipo: ${plano.meta.tipo}\n` +
    `Resumo visual: ${plano.resumoInterno}\n\n` +
    `Copy pra avaliar:\n${copyResumo}\n\n` +
    `Pontue cada uma, reescreva as fracas pra 10. JSON conforme instruído.`;

  const resposta = await comTimeoutERetry(
    () =>
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3072,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    { nome: 'Anthropic.avaliador', timeoutMs: 60_000 },
  );

  const blocoTexto = resposta.content.find((b) => b.type === 'text');
  if (!blocoTexto || blocoTexto.type !== 'text') {
    throw new Error('Avaliador não retornou texto.');
  }

  const cru = extrairJsonCru(blocoTexto.text);
  let json: unknown;
  try {
    json = JSON.parse(cru);
  } catch {
    throw new Error(
      `Avaliador não retornou JSON válido. Resposta crua:\n${blocoTexto.text.slice(0, 500)}`,
    );
  }

  const validado = respostaSchema.safeParse(json);
  if (!validado.success) {
    throw new Error(
      `JSON do avaliador não bate com o esperado: ${JSON.stringify(validado.error.issues)}`,
    );
  }

  const avaliacoes: AvaliacaoCopy[] = validado.data.copy.map((c) => ({
    rede: c.rede as Rede,
    notaAntes: c.notaAntes,
    notaDepois: c.notaDepois,
    justificativa: c.justificativa,
  }));

  const novaCopy: CopyPorRede[] = validado.data.copy.map((c) => ({
    rede: c.rede as Rede,
    titulo: c.titulo ?? undefined,
    descricao: c.descricao,
    hashtags: c.hashtags ?? [],
  }));

  return {
    planoMelhorado: { ...plano, copy: novaCopy },
    avaliacoes,
  };
}
