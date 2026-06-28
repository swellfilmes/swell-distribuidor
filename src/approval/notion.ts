import { notionDo } from '../lib/clients';
import { chunkRichText } from '../lib/notionChunks';
import { notionDbIdDo, type TenantConfig } from '../config';
import type { MidiaHospedada, PlanoPublicacao } from '../types';

const INTERVALO_POLLING_MS = 15_000;
const TIMEOUT_DEFAULT_MS = 1000 * 60 * 60 * 24;

export type StatusAprovacao = 'Aguardando' | 'Aprovado' | 'Rejeitado';

export interface LinhaCriada {
  pageId: string;
  url: string;
}

export interface DecisaoAprovacao {
  status: 'Aprovado' | 'Rejeitado';
  /** Se preenchido pelo humano, vira `scheduledFor` no Zernio (publicação agendada). Se vazio, publica agora. */
  dataPublicacao?: string;
}

export async function criarLinhaAprovacao(
  tenant: TenantConfig,
  plano: PlanoPublicacao,
  midia: MidiaHospedada,
): Promise<LinhaCriada> {
  const notion = notionDo(tenant);
  const tituloLinha = `${plano.meta.cliente} — ${plano.meta.tipo} — ${plano.meta.nomeArquivo}`;
  const copyResumo = plano.copy
    .map((c) => `[${c.rede}] ${c.descricao}`)
    .join('\n\n');

  const planoJson = JSON.stringify(plano);

  const props: Record<string, unknown> = {
    Nome: { title: [{ text: { content: tituloLinha } }] },
    Cliente: { rich_text: [{ text: { content: plano.meta.cliente } }] },
    Tipo: { select: { name: plano.meta.tipo } },
    Orientacao: { select: { name: plano.meta.orientacao } },
    Status: { select: { name: 'Aguardando' } },
    Redes: {
      multi_select: plano.redes.map((r) => ({ name: r })),
    },
    ConteudoAI: { checkbox: plano.conteudoAI },
    Video: { url: midia.urlPublica },
    Resumo: { rich_text: [{ text: { content: plano.resumoInterno } }] },
    Copy: { rich_text: chunkRichText(copyResumo) },
    PlanoJSON: { rich_text: chunkRichText(planoJson) },
  };
  if (plano.thumbnailUrl) {
    props.ThumbnailUrl = { url: plano.thumbnailUrl };
  }

  const page = await notion.pages.create({
    parent: { database_id: notionDbIdDo(tenant) },
    properties: props as never,
  });

  const url = 'url' in page && typeof page.url === 'string' ? page.url : '';
  return { pageId: page.id, url };
}

interface EstadoAtual {
  status: StatusAprovacao;
  dataPublicacao?: string;
}

async function lerEstado(
  tenant: TenantConfig,
  pageId: string,
): Promise<EstadoAtual> {
  const notion = notionDo(tenant);
  const page = await notion.pages.retrieve({ page_id: pageId });
  if (!('properties' in page)) {
    throw new Error('Página do Notion retornou sem propriedades.');
  }
  const propStatus = page.properties['Status'];
  const propData = page.properties['DataPublicacao'];

  let status: StatusAprovacao = 'Aguardando';
  if (propStatus && propStatus.type === 'select' && propStatus.select) {
    const nome = propStatus.select.name;
    if (nome === 'Aprovado' || nome === 'Rejeitado') status = nome;
  }

  let dataPublicacao: string | undefined;
  if (propData && propData.type === 'date' && propData.date?.start) {
    dataPublicacao = propData.date.start;
  }

  return { status, dataPublicacao };
}

export async function aguardarDecisao(
  tenant: TenantConfig,
  pageId: string,
  opts: { timeoutMs?: number } = {},
): Promise<DecisaoAprovacao> {
  const limite = Date.now() + (opts.timeoutMs ?? TIMEOUT_DEFAULT_MS);

  while (Date.now() < limite) {
    const estado = await lerEstado(tenant, pageId);
    if (estado.status === 'Aprovado') {
      return { status: 'Aprovado', dataPublicacao: estado.dataPublicacao };
    }
    if (estado.status === 'Rejeitado') {
      return { status: 'Rejeitado' };
    }
    await new Promise((r) => setTimeout(r, INTERVALO_POLLING_MS));
  }

  throw new Error(
    `Timeout aguardando aprovação manual no Notion (pageId=${pageId}).`,
  );
}
