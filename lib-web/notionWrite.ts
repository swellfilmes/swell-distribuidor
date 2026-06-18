import { notionDo } from '@/src/lib/clients';
import { chunkRichText } from '@/src/lib/notionChunks';
import type { TenantConfig } from '@/src/config';
import type { PlanoPublicacao, Rede } from '@/src/types';
import {
  carregarPost,
  STATUS_VALORES,
  TIPO_VALORES,
  REDE_VALORES,
} from './notionData';

export interface PatchPostInput {
  status?: string;
  /** ISO 8601 (com fuso). Passe null/"" pra limpar. */
  dataPublicacao?: string | null;
  cliente?: string;
  tipo?: string;
  redes?: string[];
  conteudoAI?: boolean;
  /** Edita copy por rede. As redes omitidas ficam como estão. */
  copy?: Partial<Record<Rede, { descricao?: string; titulo?: string; hashtags?: string[] }>>;
}

export interface PatchResultado {
  /** Mudanças que viraram propriedades Notion (pro client poder reaplicar otimista). */
  campos: string[];
}

function montarCopyTextual(copy: PlanoPublicacao['copy']): string {
  return copy.map((c) => `[${c.rede}] ${c.descricao}`).join('\n\n');
}

function validarEnums(input: PatchPostInput): void {
  if (input.status !== undefined && !STATUS_VALORES.includes(input.status as never)) {
    throw new Error(
      `Status inválido: "${input.status}". Esperado: ${STATUS_VALORES.join(', ')}.`,
    );
  }
  if (input.tipo !== undefined && !TIPO_VALORES.includes(input.tipo as never)) {
    throw new Error(
      `Tipo inválido: "${input.tipo}". Esperado: ${TIPO_VALORES.join(', ')}.`,
    );
  }
  if (input.redes !== undefined) {
    for (const r of input.redes) {
      if (!REDE_VALORES.includes(r as never)) {
        throw new Error(
          `Rede inválida: "${r}". Esperado: ${REDE_VALORES.join(', ')}.`,
        );
      }
    }
  }
}

/**
 * Aplica um patch parcial no Notion.
 *
 * Otimização (Onda 1):
 *  - Pre-fetch só quando edita copy (precisa do plano atual pra mergear).
 *  - Sem refetch pós-update: client mantém estado otimista; auto-refresh 30s
 *    reconcilia. Em status/data/tipo: 1 roundtrip total (era 3).
 */
export async function patchPostNoNotion(
  tenant: TenantConfig,
  pageId: string,
  input: PatchPostInput,
): Promise<PatchResultado> {
  validarEnums(input);

  const notion = notionDo(tenant);

  let novoPlano: PlanoPublicacao | null = null;
  let novoCopyTextual: string | null = null;

  if (input.copy && Object.keys(input.copy).length > 0) {
    // 1 roundtrip Notion (necessário pra mergear copy estruturada)
    const atual = await carregarPost(tenant, pageId);
    if (!atual) throw new Error('Post não encontrado pra editar copy.');
    if (!atual.plano) {
      throw new Error(
        'Esse post não tem PlanoJSON ainda. Rode --reparar-copy antes de editar.',
      );
    }
    const novaCopy = atual.plano.copy.map((c) => {
      const edit = input.copy?.[c.rede];
      if (!edit) return c;
      return {
        ...c,
        descricao: edit.descricao !== undefined ? edit.descricao : c.descricao,
        titulo: edit.titulo !== undefined ? edit.titulo : c.titulo,
        hashtags: edit.hashtags !== undefined ? edit.hashtags : c.hashtags,
      };
    });
    novoPlano = { ...atual.plano, copy: novaCopy };
    novoCopyTextual = montarCopyTextual(novaCopy);
  }

  const properties: Record<string, unknown> = {};
  const campos: string[] = [];

  if (input.status !== undefined) {
    properties.Status = { select: { name: input.status } };
    campos.push('status');
  }
  if (input.dataPublicacao !== undefined) {
    properties.DataPublicacao =
      input.dataPublicacao && input.dataPublicacao.length > 0
        ? { date: { start: input.dataPublicacao } }
        : { date: null };
    campos.push('dataPublicacao');
  }
  if (input.cliente !== undefined) {
    properties.Cliente = {
      rich_text: [{ text: { content: input.cliente } }],
    };
    campos.push('cliente');
  }
  if (input.tipo !== undefined) {
    properties.Tipo = { select: { name: input.tipo } };
    campos.push('tipo');
  }
  if (input.redes !== undefined) {
    properties.Redes = {
      multi_select: input.redes.map((r) => ({ name: r })),
    };
    campos.push('redes');
  }
  if (input.conteudoAI !== undefined) {
    properties.ConteudoAI = { checkbox: input.conteudoAI };
    campos.push('conteudoAI');
  }
  if (novoCopyTextual !== null) {
    properties.Copy = { rich_text: chunkRichText(novoCopyTextual) };
    campos.push('copy');
  }
  if (novoPlano !== null) {
    properties.PlanoJSON = {
      rich_text: chunkRichText(JSON.stringify(novoPlano)),
    };
  }

  if (Object.keys(properties).length === 0) {
    return { campos: [] };
  }

  // 1 roundtrip Notion (write)
  await notion.pages.update({
    page_id: pageId,
    properties: properties as never,
  });

  return { campos };
}
