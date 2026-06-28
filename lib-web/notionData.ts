import { notionDo } from '@/src/lib/clients';
import { notionDbIdDo, type TenantConfig } from '@/src/config';
import type {
  Orientacao,
  PlanoPublicacao,
  Rede,
  TipoVideo,
} from '@/src/types';

export type StatusPost =
  | 'Aguardando'
  | 'Aprovado'
  | 'Rejeitado'
  | 'Agendado'
  | 'Publicado'
  | 'Publicado parcial'
  | 'Pendente Zernio'
  | 'Falhou';

export const STATUS_VALORES: StatusPost[] = [
  'Aguardando',
  'Aprovado',
  'Rejeitado',
  'Agendado',
  'Publicado',
  'Publicado parcial',
  'Pendente Zernio',
  'Falhou',
];

export const TIPO_VALORES: TipoVideo[] = [
  'aftermovie',
  'reel',
  'bastidor',
  'institucional',
  'minidoc',
  'ai',
];

export const REDE_VALORES: Rede[] = ['youtube', 'instagram', 'tiktok', 'linkedin'];

export interface PostListado {
  pageId: string;
  notionUrl: string;
  nome: string;
  cliente: string;
  tipo: TipoVideo | string;
  orientacao: Orientacao | string;
  status: StatusPost | string;
  redes: Rede[];
  conteudoAI: boolean;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  resumo: string;
  copyResumo: string;
  dataPublicacao: string | null;
  publicadoEm: string | null;
  logPublicacao: string;
  linkPublicado: string | null;
  zernioPostId: string;
  plano: PlanoPublicacao | null;
  criadoEm: string;
  atualizadoEm: string;
}

function lerRichText(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; rich_text?: Array<{ plain_text?: string }> };
  if (p.type !== 'rich_text' || !p.rich_text) return '';
  return p.rich_text.map((t) => t.plain_text ?? '').join('').trim();
}

function lerTitle(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; title?: Array<{ plain_text?: string }> };
  if (p.type !== 'title' || !p.title) return '';
  return p.title.map((t) => t.plain_text ?? '').join('').trim();
}

function lerSelect(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; select?: { name?: string } | null };
  if (p.type !== 'select' || !p.select?.name) return '';
  return p.select.name;
}

function lerMultiSelect(prop: unknown): string[] {
  if (!prop || typeof prop !== 'object') return [];
  const p = prop as { type?: string; multi_select?: Array<{ name?: string }> };
  if (p.type !== 'multi_select' || !p.multi_select) return [];
  return p.multi_select.map((s) => s.name ?? '').filter(Boolean);
}

function lerUrl(prop: unknown): string | null {
  if (!prop || typeof prop !== 'object') return null;
  const p = prop as { type?: string; url?: string | null };
  if (p.type !== 'url' || !p.url) return null;
  return p.url;
}

function lerCheckbox(prop: unknown): boolean {
  if (!prop || typeof prop !== 'object') return false;
  const p = prop as { type?: string; checkbox?: boolean };
  return p.type === 'checkbox' && p.checkbox === true;
}

function lerDateStart(prop: unknown): string | null {
  if (!prop || typeof prop !== 'object') return null;
  const p = prop as { type?: string; date?: { start?: string | null } | null };
  if (p.type !== 'date' || !p.date?.start) return null;
  return p.date.start;
}

export type CampoSort =
  | 'dataPublicacao'
  | 'criado'
  | 'atualizado'
  | 'status'
  | 'cliente'
  | 'tipo';

export type DirecaoSort = 'asc' | 'desc';

export interface FiltrosPosts {
  status?: string;
  cliente?: string;
  /** Formato YYYY-MM. Filtra DataPublicacao dentro do mês. */
  mes?: string;
  tipo?: string;
  /** Lista de redes — post precisa ter QUALQUER UMA delas. */
  redes?: string[];
  sort?: CampoSort;
  dir?: DirecaoSort;
  limit?: number;
}

function rangeDoMes(mes: string): { de: string; ate: string } | null {
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const ano = parseInt(m[1], 10);
  const mesNum = parseInt(m[2], 10);
  if (mesNum < 1 || mesNum > 12) return null;
  const de = `${ano}-${String(mesNum).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mesNum, 0).getDate();
  const ate = `${ano}-${String(mesNum).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  return { de, ate };
}

function montarSorts(
  campo: CampoSort | undefined,
  dir: DirecaoSort | undefined,
): unknown[] {
  const direction = dir === 'asc' ? 'ascending' : 'descending';
  if (!campo) {
    return [
      { property: 'DataPublicacao', direction: 'descending' },
      { timestamp: 'created_time', direction: 'descending' },
    ];
  }
  switch (campo) {
    case 'dataPublicacao':
      return [{ property: 'DataPublicacao', direction }];
    case 'criado':
      return [{ timestamp: 'created_time', direction }];
    case 'atualizado':
      return [{ timestamp: 'last_edited_time', direction }];
    case 'status':
      return [{ property: 'Status', direction }];
    case 'cliente':
      return [{ property: 'Cliente', direction }];
    case 'tipo':
      return [{ property: 'Tipo', direction }];
  }
}

export async function listarPostsDoNotion(
  tenant: TenantConfig,
  opts: FiltrosPosts = {},
): Promise<PostListado[]> {
  const notion = notionDo(tenant);
  const filtros: unknown[] = [];

  if (opts.status) {
    filtros.push({ property: 'Status', select: { equals: opts.status } });
  }
  if (opts.cliente) {
    filtros.push({
      property: 'Cliente',
      rich_text: { contains: opts.cliente },
    });
  }
  if (opts.tipo) {
    filtros.push({ property: 'Tipo', select: { equals: opts.tipo } });
  }
  if (opts.redes && opts.redes.length > 0) {
    const orRedes = opts.redes.map((r) => ({
      property: 'Redes',
      multi_select: { contains: r },
    }));
    if (orRedes.length === 1) filtros.push(orRedes[0]);
    else filtros.push({ or: orRedes });
  }
  if (opts.mes) {
    const range = rangeDoMes(opts.mes);
    if (range) {
      filtros.push({
        property: 'DataPublicacao',
        date: { on_or_after: range.de },
      });
      filtros.push({
        property: 'DataPublicacao',
        date: { on_or_before: range.ate },
      });
    }
  }

  const filter = filtros.length > 0 ? { and: filtros } : undefined;
  const limit = Math.min(opts.limit ?? 100, 100);

  const resp = await notion.databases.query({
    database_id: notionDbIdDo(tenant),
    filter: filter as never,
    sorts: montarSorts(opts.sort, opts.dir) as never,
    page_size: limit,
  });

  const posts: PostListado[] = [];
  for (const page of resp.results) {
    if (!('properties' in page)) continue;
    posts.push(materializarPost(page));
  }
  return posts;
}

function materializarPost(page: {
  id: string;
  url?: string;
  created_time?: string;
  last_edited_time?: string;
  properties: Record<string, unknown>;
}): PostListado {
  const props = page.properties;
  const planoStr = lerRichText(props['PlanoJSON']);
  let plano: PlanoPublicacao | null = null;
  if (planoStr) {
    try {
      plano = JSON.parse(planoStr) as PlanoPublicacao;
    } catch {
      plano = null;
    }
  }
  return {
    pageId: page.id,
    notionUrl: typeof page.url === 'string' ? page.url : '',
    nome: lerTitle(props['Nome']) || '(sem nome)',
    cliente: lerRichText(props['Cliente']),
    tipo: lerSelect(props['Tipo']),
    orientacao: lerSelect(props['Orientacao']),
    status: lerSelect(props['Status']) || 'Aguardando',
    redes: lerMultiSelect(props['Redes']) as Rede[],
    conteudoAI: lerCheckbox(props['ConteudoAI']),
    videoUrl: lerUrl(props['Video']),
    thumbnailUrl: lerUrl(props['ThumbnailUrl']),
    resumo: lerRichText(props['Resumo']),
    copyResumo: lerRichText(props['Copy']),
    dataPublicacao: lerDateStart(props['DataPublicacao']),
    publicadoEm: lerDateStart(props['PublicadoEm']),
    logPublicacao: lerRichText(props['LogPublicacao']),
    linkPublicado: lerUrl(props['LinkPublicado']),
    zernioPostId: lerRichText(props['ZernioPostId']),
    plano,
    criadoEm: typeof page.created_time === 'string' ? page.created_time : '',
    atualizadoEm: typeof page.last_edited_time === 'string' ? page.last_edited_time : '',
  };
}

/** Carrega um post único por pageId (pro side panel detalhado). */
export async function carregarPost(
  tenant: TenantConfig,
  pageId: string,
): Promise<PostListado | null> {
  const notion = notionDo(tenant);
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    if (!('properties' in page)) return null;
    return materializarPost(page as never);
  } catch {
    return null;
  }
}

/** Lista valores únicos de Cliente nos posts (pro filtro). */
export function clientesUnicos(posts: PostListado[]): string[] {
  const set = new Set<string>();
  for (const p of posts) {
    if (p.cliente) set.add(p.cliente);
  }
  return [...set].sort();
}

/**
 * Cache em memória de "todos os clientes desta empresa" — evita 2ª query Notion
 * quando o filtro de cliente está ativo na tabela.
 * TTL: 10 min. Invalida na criação/edição via `invalidarCacheClientes(slug)`.
 */
const cacheClientes = new Map<string, { lista: string[]; expiraEm: number }>();
const TTL_CACHE_CLIENTES_MS = 10 * 60 * 1000;

export async function clientesDaEmpresa(
  tenant: TenantConfig,
): Promise<string[]> {
  const agora = Date.now();
  const hit = cacheClientes.get(tenant.slug);
  if (hit && hit.expiraEm > agora) return hit.lista;

  // Sem cache: puxa lista completa do Notion 1x.
  const todos = await listarPostsDoNotion(tenant, {});
  const lista = clientesUnicos(todos);
  cacheClientes.set(tenant.slug, { lista, expiraEm: agora + TTL_CACHE_CLIENTES_MS });
  return lista;
}

export function invalidarCacheClientes(slug?: string): void {
  if (slug) cacheClientes.delete(slug);
  else cacheClientes.clear();
}
