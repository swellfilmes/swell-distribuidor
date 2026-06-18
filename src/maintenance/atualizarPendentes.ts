import { notionDo, zernioDo } from '../lib/clients';
import { registrarResultado } from '../log/notion';
import type { TenantConfig } from '../config';
import type { Rede, ResultadoPublicacao } from '../types';

// Inclui 'Agendado' pra detectar transição Agendado → Publicado (Zernio publica
// sozinho na hora marcada — sem isso, fica "Agendado" pra sempre no Notion).
const STATUS_PRA_REVISAR = ['Publicado parcial', 'Pendente Zernio', 'Agendado'];

const REDES: readonly Rede[] = ['youtube', 'instagram', 'tiktok', 'linkedin'];

interface LinhaPendente {
  pageId: string;
  nome: string;
  zernioPostId: string;
  redes: Rede[];
}

async function buscarLinhasPendentes(
  tenant: TenantConfig,
): Promise<LinhaPendente[]> {
  const notion = notionDo(tenant);
  const linhas: LinhaPendente[] = [];
  let cursor: string | undefined;

  do {
    const resp = await notion.databases.query({
      database_id: tenant.notionDbId,
      start_cursor: cursor,
      filter: {
        or: STATUS_PRA_REVISAR.map((nome) => ({
          property: 'Status',
          select: { equals: nome },
        })),
      },
    });

    for (const page of resp.results) {
      if (!('properties' in page)) continue;
      const props = page.properties;
      const zid = lerRichText(props['ZernioPostId']);
      if (!zid) continue;
      const nome = lerTitle(props['Nome']) || '(sem nome)';
      const redes = lerMultiSelect(props['Redes']) as Rede[];
      linhas.push({ pageId: page.id, nome, zernioPostId: zid, redes });
    }

    cursor = resp.has_more ? resp.next_cursor ?? undefined : undefined;
  } while (cursor);

  return linhas;
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

function lerMultiSelect(prop: unknown): string[] {
  if (!prop || typeof prop !== 'object') return [];
  const p = prop as { type?: string; multi_select?: Array<{ name?: string }> };
  if (p.type !== 'multi_select' || !p.multi_select) return [];
  return p.multi_select.map((s) => s.name ?? '').filter(Boolean);
}

async function buscarEstadoZernio(
  tenant: TenantConfig,
  postId: string,
  redes: Rede[],
): Promise<ResultadoPublicacao[]> {
  const zernio = zernioDo(tenant);
  const resposta = await zernio.posts.getPost({ path: { postId } });
  const data = (
    resposta as {
      data?: {
        post?: {
          platforms?: Array<{
            platform?: string;
            status?: string;
            platformPostUrl?: string;
            platformPostId?: string;
            errorMessage?: string;
          }>;
        };
      };
    }
  ).data;

  const platforms = data?.post?.platforms ?? [];

  return redes.map((rede) => {
    const target = platforms.find((p) => p.platform === rede);
    if (!target) {
      return {
        rede,
        idExterno: postId,
        status: 'pendente' as const,
        erro: 'plataforma não encontrada no post do Zernio.',
      };
    }
    const status = target.status ?? '';
    if (status === 'published') {
      return {
        rede,
        idExterno: target.platformPostId ?? postId,
        url: target.platformPostUrl,
        status: 'publicado' as const,
      };
    }
    if (status === 'failed') {
      return {
        rede,
        idExterno: postId,
        status: 'falhou' as const,
        erro: target.errorMessage ?? 'falhou (sem mensagem)',
      };
    }
    return {
      rede,
      idExterno: postId,
      status: 'pendente' as const,
      erro: `ainda em "${status}" no Zernio`,
    };
  });
}

export async function atualizarPendentes(
  tenant: TenantConfig,
  onLog: (msg: string) => void = (m) => console.log(m),
): Promise<void> {
  onLog('Buscando linhas pendentes no Notion...');
  const linhas = await buscarLinhasPendentes(tenant);
  onLog(`Encontradas ${linhas.length} linha(s) com Status pendente/parcial.`);

  if (linhas.length === 0) return;

  for (const linha of linhas) {
    onLog(`\n→ ${linha.nome} (postId=${linha.zernioPostId})`);

    const redesValidas = linha.redes.length
      ? linha.redes
      : (REDES as unknown as Rede[]);

    let resultados: ResultadoPublicacao[];
    try {
      resultados = await buscarEstadoZernio(tenant, linha.zernioPostId, redesValidas);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog(`  ❌ erro consultando Zernio: ${msg}`);
      continue;
    }

    for (const r of resultados) {
      if (r.status === 'publicado') {
        onLog(`  ✅ ${r.rede}${r.url ? ` → ${r.url}` : ''}`);
      } else if (r.status === 'pendente') {
        onLog(`  ⏳ ${r.rede}: ${r.erro}`);
      } else {
        onLog(`  ❌ ${r.rede}: ${r.erro}`);
      }
    }

    await registrarResultado(tenant, linha.pageId, resultados, [], linha.zernioPostId);
    onLog(`  ✅ Notion atualizado.`);
  }
}
