import { notionDo } from '@/src/lib/clients';
import { chunkRichText } from '@/src/lib/notionChunks';
import type { TenantConfig } from '@/src/config';
import type { PlanoPublicacao, Rede } from '@/src/types';
import { carregarPost, type PostListado } from './notionData';

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

function montarCopyTextual(copy: PlanoPublicacao['copy']): string {
  return copy.map((c) => `[${c.rede}] ${c.descricao}`).join('\n\n');
}

export async function patchPostNoNotion(
  tenant: TenantConfig,
  pageId: string,
  input: PatchPostInput,
): Promise<PostListado | null> {
  const notion = notionDo(tenant);

  // Pra editar copy, precisamos carregar o plano atual e mergear.
  let novoPlano: PlanoPublicacao | null = null;
  let novoCopyTextual: string | null = null;

  if (input.copy && Object.keys(input.copy).length > 0) {
    const atual = await carregarPost(tenant, pageId);
    if (!atual) throw new Error('Post não encontrado pra editar copy.');
    if (!atual.plano) {
      // Sem PlanoJSON, criamos um esqueleto mínimo
      throw new Error(
        'Esse post não tem PlanoJSON ainda. Rode --reparar-copy antes de editar.',
      );
    }
    novoPlano = { ...atual.plano };
    const novaCopy = novoPlano.copy.map((c) => {
      const edit = input.copy?.[c.rede];
      if (!edit) return c;
      return {
        ...c,
        descricao: edit.descricao !== undefined ? edit.descricao : c.descricao,
        titulo: edit.titulo !== undefined ? edit.titulo : c.titulo,
        hashtags: edit.hashtags !== undefined ? edit.hashtags : c.hashtags,
      };
    });
    novoPlano.copy = novaCopy;
    novoCopyTextual = montarCopyTextual(novaCopy);
  }

  const properties: Record<string, unknown> = {};

  if (input.status !== undefined) {
    properties.Status = { select: { name: input.status } };
  }
  if (input.dataPublicacao !== undefined) {
    properties.DataPublicacao =
      input.dataPublicacao && input.dataPublicacao.length > 0
        ? { date: { start: input.dataPublicacao } }
        : { date: null };
  }
  if (input.cliente !== undefined) {
    properties.Cliente = {
      rich_text: [{ text: { content: input.cliente } }],
    };
  }
  if (input.tipo !== undefined) {
    properties.Tipo = { select: { name: input.tipo } };
  }
  if (input.redes !== undefined) {
    properties.Redes = {
      multi_select: input.redes.map((r) => ({ name: r })),
    };
  }
  if (input.conteudoAI !== undefined) {
    properties.ConteudoAI = { checkbox: input.conteudoAI };
  }
  if (novoCopyTextual !== null) {
    properties.Copy = { rich_text: chunkRichText(novoCopyTextual) };
  }
  if (novoPlano !== null) {
    properties.PlanoJSON = {
      rich_text: chunkRichText(JSON.stringify(novoPlano)),
    };
  }

  if (Object.keys(properties).length === 0) {
    // Nada pra atualizar, devolve estado atual
    return carregarPost(tenant, pageId);
  }

  await notion.pages.update({
    page_id: pageId,
    properties: properties as never,
  });

  return carregarPost(tenant, pageId);
}
