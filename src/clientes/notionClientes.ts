import { notionDo } from '../lib/clients';
import type { TenantConfig } from '../tenant';
import type { Rede } from '../types';

/**
 * Multi-cliente via Profiles do Zernio: cada cliente da empresa (ex: Austral,
 * Metroval) tem 1 Profile no Zernio + 1 linha nesse banco Notion separado
 * (`tenant.notionClientsDbId`).
 *
 * Distinct dos posts: o banco principal (notionDbId) é a fila de aprovação.
 * Esse banco aqui é cadastro de clientes — N linhas, uma por cliente, com
 * profileId Zernio + accountIds de cada rede.
 *
 * Schema esperado (criar manualmente ou via `criarClientesDb`):
 *  - ClientId          (title)        — slug curto: "austral", "metroval"
 *  - Nome              (rich_text)    — nome de display
 *  - ZernioProfileId   (rich_text)    — id retornado por profiles.createProfile
 *  - InstagramAccountId (rich_text)
 *  - YouTubeAccountId   (rich_text)
 *  - TikTokAccountId    (rich_text)
 *  - LinkedInAccountId  (rich_text)
 *  - Status            (select)       — "Pendente Conexão" | "Ativo" | "Inativo"
 */

export interface ClienteRow {
  pageId: string;
  clientId: string;
  nome: string;
  zernioProfileId: string;
  status: 'Pendente Conexão' | 'Ativo' | 'Inativo' | string;
  accountIds: Partial<Record<Rede, string>>;
}

function lerTitle(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; title?: Array<{ plain_text?: string }> };
  if (p.type !== 'title' || !p.title) return '';
  return p.title.map((t) => t.plain_text ?? '').join('').trim();
}
function lerRich(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; rich_text?: Array<{ plain_text?: string }> };
  if (p.type !== 'rich_text' || !p.rich_text) return '';
  return p.rich_text.map((t) => t.plain_text ?? '').join('').trim();
}
function lerSelect(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; select?: { name?: string } | null };
  if (p.type !== 'select' || !p.select?.name) return '';
  return p.select.name;
}

function exigirClientsDb(tenant: TenantConfig): string {
  if (!tenant.notionClientsDbId) {
    throw new Error(
      `Empresa "${tenant.slug}" não tem banco Notion de clientes configurado.\n` +
        `Crie um banco no Notion com as colunas: ClientId (title), Nome, ZernioProfileId,\n` +
        `InstagramAccountId, YouTubeAccountId, TikTokAccountId, LinkedInAccountId (rich_text)\n` +
        `e Status (select: "Pendente Conexão" | "Ativo" | "Inativo"). Cole o database_id em\n` +
        `tenant_secrets.notion_clients_db_id OU na env NOTION_CLIENTS_DB_ID (Swell legacy).`,
    );
  }
  return tenant.notionClientsDbId;
}

function materializar(page: { id: string; properties: Record<string, unknown> }): ClienteRow {
  const props = page.properties;
  return {
    pageId: page.id,
    clientId: lerTitle(props['ClientId']) || lerTitle(props['Nome']),
    nome: lerRich(props['Nome']) || lerTitle(props['ClientId']),
    zernioProfileId: lerRich(props['ZernioProfileId']),
    status: lerSelect(props['Status']) || 'Pendente Conexão',
    accountIds: {
      instagram: lerRich(props['InstagramAccountId']) || undefined,
      youtube: lerRich(props['YouTubeAccountId']) || undefined,
      tiktok: lerRich(props['TikTokAccountId']) || undefined,
      linkedin: lerRich(props['LinkedInAccountId']) || undefined,
    },
  };
}

export async function buscarClientePorSlug(
  tenant: TenantConfig,
  clientId: string,
): Promise<ClienteRow | null> {
  const notion = notionDo(tenant);
  const db = exigirClientsDb(tenant);
  const resp = await notion.databases.query({
    database_id: db,
    filter: { property: 'ClientId', title: { equals: clientId } },
    page_size: 1,
  });
  if (resp.results.length === 0) return null;
  const page = resp.results[0];
  if (!('properties' in page)) return null;
  return materializar(page as { id: string; properties: Record<string, unknown> });
}

export async function listarClientes(tenant: TenantConfig): Promise<ClienteRow[]> {
  const notion = notionDo(tenant);
  const db = exigirClientsDb(tenant);
  const linhas: ClienteRow[] = [];
  let cursor: string | undefined;
  do {
    const resp = await notion.databases.query({
      database_id: db,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of resp.results) {
      if (!('properties' in page)) continue;
      linhas.push(materializar(page as { id: string; properties: Record<string, unknown> }));
    }
    cursor = resp.has_more ? resp.next_cursor ?? undefined : undefined;
  } while (cursor);
  return linhas;
}

export interface CriarClienteInput {
  clientId: string;
  nome: string;
  zernioProfileId: string;
  accountIds?: Partial<Record<Rede, string>>;
  status?: 'Pendente Conexão' | 'Ativo' | 'Inativo';
}

export async function criarLinhaCliente(
  tenant: TenantConfig,
  input: CriarClienteInput,
): Promise<{ pageId: string; url: string }> {
  const notion = notionDo(tenant);
  const db = exigirClientsDb(tenant);
  const props: Record<string, unknown> = {
    ClientId: { title: [{ text: { content: input.clientId } }] },
    Nome: { rich_text: [{ text: { content: input.nome } }] },
    ZernioProfileId: { rich_text: [{ text: { content: input.zernioProfileId } }] },
    Status: { select: { name: input.status ?? 'Pendente Conexão' } },
  };
  const accs = input.accountIds ?? {};
  if (accs.instagram) props.InstagramAccountId = { rich_text: [{ text: { content: accs.instagram } }] };
  if (accs.youtube) props.YouTubeAccountId = { rich_text: [{ text: { content: accs.youtube } }] };
  if (accs.tiktok) props.TikTokAccountId = { rich_text: [{ text: { content: accs.tiktok } }] };
  if (accs.linkedin) props.LinkedInAccountId = { rich_text: [{ text: { content: accs.linkedin } }] };

  const page = await notion.pages.create({
    parent: { database_id: db },
    properties: props as never,
  });
  const url = 'url' in page && typeof page.url === 'string' ? page.url : '';
  return { pageId: page.id, url };
}

export async function atualizarAccountIds(
  tenant: TenantConfig,
  pageId: string,
  accountIds: Partial<Record<Rede, string>>,
  status?: ClienteRow['status'],
): Promise<void> {
  const notion = notionDo(tenant);
  const props: Record<string, unknown> = {};
  if (accountIds.instagram !== undefined)
    props.InstagramAccountId = { rich_text: [{ text: { content: accountIds.instagram } }] };
  if (accountIds.youtube !== undefined)
    props.YouTubeAccountId = { rich_text: [{ text: { content: accountIds.youtube } }] };
  if (accountIds.tiktok !== undefined)
    props.TikTokAccountId = { rich_text: [{ text: { content: accountIds.tiktok } }] };
  if (accountIds.linkedin !== undefined)
    props.LinkedInAccountId = { rich_text: [{ text: { content: accountIds.linkedin } }] };
  if (status) props.Status = { select: { name: status } };

  if (Object.keys(props).length === 0) return;
  await notion.pages.update({ page_id: pageId, properties: props as never });
}
