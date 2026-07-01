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

Você é o redator de captions da marca. Um humano vai te passar uma copy que ele quer AJUSTAR seguindo uma INSTRUÇÃO específica (ex: "mais direto", "menciona a marca", "menos formal", "adiciona CTA no fim").

REGRAS:
- LEIA a instrução com atenção. Aplique EXATAMENTE o que foi pedido.
- Mantenha o array de redes na MESMA ORDEM e MESMA QUANTIDADE.
- Se a instrução se aplica só a uma rede específica (ex: "só a do LinkedIn"), MANTENHA as outras redes intocadas.
- Se a instrução é geral (ex: "mais direto"), aplique EM TODAS as redes.
- Preserve o tom da marca acima em qualquer ajuste.
- PROIBIDO usar traço em (—) ou traço médio (–) como separador visual dentro das legendas. Separe parágrafos com quebra de linha (\n). Nunca use exclamação forçada.
- Se a instrução for vaga ou contraditória com o tom da marca, priorize o TOM DA MARCA e faça o melhor palpite pra atender o humano.

Responda APENAS com JSON nesse formato:
{
  "copy": [
    { "rede": "youtube", "titulo": "...", "descricao": "...", "hashtags": ["...", "..."] },
    ...
  ]
}`;
}

/**
 * Reescreve a copy de um plano seguindo a instrução em texto livre do usuário
 * ("mais direto", "menciona a marca X", "menos formal", etc). Preserva a
 * quantidade e ordem de redes. Retorna um novo plano — não muta o original.
 */
export async function ajustarCopyComFeedback(
  plano: PlanoPublicacao,
  instrucao: string,
  tomVoz?: string,
): Promise<PlanoPublicacao> {
  const instrucaoLimpa = instrucao.trim();
  if (!instrucaoLimpa) throw new Error('Instrução vazia — nada pra ajustar.');
  if (instrucaoLimpa.length > 2000) {
    throw new Error('Instrução muito longa (máx 2000 caracteres).');
  }

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
    `Copy ATUAL:\n${copyResumo}\n\n` +
    `─── INSTRUÇÃO DO HUMANO ───\n${instrucaoLimpa}\n─────────────────────────\n\n` +
    `Aplique a instrução. Responda em JSON conforme instruído.`;

  const resposta = await comTimeoutERetry(
    () =>
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3072,
        system: buildSystemPrompt(tomVoz),
        messages: [{ role: 'user', content: userMessage }],
      }),
    { nome: 'Anthropic.ajustarCopyComFeedback', timeoutMs: 60_000 },
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
      `JSON do ajuste não bate com o esperado: ${JSON.stringify(validado.error.issues)}`,
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
