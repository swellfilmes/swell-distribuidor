import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { globalConfig } from '../config';
import type { Rede } from '../types';

const client = new Anthropic({ apiKey: globalConfig.ANTHROPIC_API_KEY });

function extrairJsonCru(texto: string): string {
  const trim = texto.trim();
  const match = trim.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  return (match ? match[1] : trim).trim();
}

export interface ItemPraAgendar {
  pageId: string;
  cliente: string;
  tipo: string;
  redes: Rede[];
  resumoCurto: string;
}

export interface AgendamentoItem {
  pageId: string;
  scheduledFor: string;
  justificativa: string;
}

const respostaSchema = z.object({
  agenda: z
    .array(
      z.object({
        pageId: z.string(),
        scheduledFor: z.string(),
        justificativa: z.string(),
      }),
    )
    .min(1),
});

const SYSTEM_PROMPT = `Você é o ESTRATEGISTA DE CRONOGRAMA da Swell Filmes. Sua função: ler uma lista de vídeos prontos pra publicar e definir um calendário completo de quando cada um sai no ar.

REGRAS NÃO-NEGOCIÁVEIS DE ESPAÇAMENTO:
1. **NO MÁXIMO 1 PUBLICAÇÃO POR DIA** (no DB inteiro). Os vídeos disparam várias redes numa só chamada, então 1 linha por dia já satura.
2. **Comece a partir de AMANHÃ** (não hoje — pra dar tempo do humano revisar antes).
3. **Não pular dias úteis sem motivo**. Pode pular fim de semana se fizer sentido pro conteúdo.
4. **Mistura inteligente**: não enfileire 4 aftermovies seguidos. Alterne tipos (aftermovie, reel, institucional) e clientes.
5. **Conteúdo B2B (LinkedIn + YouTube institucional)**: **só dias úteis, manhã**.
6. **Conteúdo consumer/entretenimento (Instagram, TikTok, YouTube Shorts)**: pode ser qualquer dia, **inclusive sábado e domingo**.

BEST TIMES POR REDE (use o melhor horário pra rede DOMINANTE de cada vídeo, considerando a audiência):
- **LinkedIn**: terça/quarta/quinta, **09:30** ou **17:00** (horário antes de chegar no trabalho ou na hora do café da tarde). NUNCA fim de semana.
- **Instagram**: qualquer dia, picos **12:00-13:00** (almoço) e **19:00-21:00** (após jantar). Fins de semana ainda mais tarde.
- **YouTube**: dias úteis **20:00-22:00**, fins de semana **15:00-18:00** (consumo longo).
- **TikTok**: picos **19:00-23:00** todo dia. Forte aos sábados.

REGRA PRÁTICA POR REDES DA LINHA:
- Se redes inclui LinkedIn (mesmo que tenha outras): horário = LinkedIn (09:30 ou 17:00 em dia útil).
- Se SEM LinkedIn, com Instagram OU TikTok: horário = Instagram/TikTok (19:00-21:00 ou 12:30).
- Se redes = só YouTube: horário = 20:00 dia útil ou 16:00 fim de semana.

Timezone: **America/Bahia** (GMT-3). Devolva datetimes em formato ISO 8601 sem timezone (ex: "2026-06-12T17:00:00"). Eu adiciono o offset depois.

Hoje é: {{HOJE}}.

Pra cada item, responda no JSON:
{
  "agenda": [
    {
      "pageId": "id-da-linha-no-notion",
      "scheduledFor": "2026-06-12T17:00:00",
      "justificativa": "frase curta explicando a escolha"
    },
    ...
  ]
}

Devolva TODAS as linhas, na ordem do calendário (do mais cedo pro mais tarde).`;

export async function gerarCronograma(itens: ItemPraAgendar[]): Promise<AgendamentoItem[]> {
  const hoje = new Date().toISOString().slice(0, 10);

  const listaTexto = itens
    .map(
      (it, idx) =>
        `${idx + 1}. pageId=${it.pageId}\n   cliente=${it.cliente}  tipo=${it.tipo}  redes=${it.redes.join(',')}\n   resumo: ${it.resumoCurto.slice(0, 200)}`,
    )
    .join('\n\n');

  const userMessage =
    `Tenho ${itens.length} vídeos pra agendar. Distribua no calendário seguindo as regras:\n\n${listaTexto}\n\n` +
    `Comece em ${hoje} + 1 dia. Use a estratégia de espaçamento e horários certos. Devolva JSON.`;

  const sysPrompt = SYSTEM_PROMPT.replace('{{HOJE}}', hoje);

  const resposta = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    system: sysPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const blocoTexto = resposta.content.find((b) => b.type === 'text');
  if (!blocoTexto || blocoTexto.type !== 'text') {
    throw new Error('Agendador não retornou texto.');
  }

  const cru = extrairJsonCru(blocoTexto.text);
  let json: unknown;
  try {
    json = JSON.parse(cru);
  } catch {
    throw new Error(
      `Agendador não retornou JSON válido. Resposta crua:\n${blocoTexto.text.slice(0, 500)}`,
    );
  }

  const validado = respostaSchema.safeParse(json);
  if (!validado.success) {
    throw new Error(
      `JSON do agendador não bate com o esperado: ${JSON.stringify(validado.error.issues)}`,
    );
  }

  return validado.data.agenda;
}
