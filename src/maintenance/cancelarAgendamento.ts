import { notionDo, zernioDo } from '../lib/clients';
import { chunkRichText } from '../lib/notionChunks';
import type { TenantConfig } from '../config';

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

function lerStatus(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; select?: { name?: string } | null };
  if (p.type !== 'select' || !p.select?.name) return '';
  return p.select.name;
}

interface PlataformaResposta {
  platform?: string;
  status?: string;
  platformPostUrl?: string;
  platformPostId?: string;
  scheduledFor?: string;
}

/**
 * Distingue, na resposta do Zernio, quais redes já tiveram upload feito na
 * plataforma (status=published com URL/postId presentes) e quais ainda estão
 * pendentes só no Zernio.
 *
 * O YouTube faz upload imediato e usa publishAt nativo — ou seja, deletePost
 * no Zernio NÃO remove o vídeo do YouTube. Precisa avisar o humano.
 */
function classificarPlataformas(plats: PlataformaResposta[]): {
  uploadFeito: PlataformaResposta[];
  somenteZernio: PlataformaResposta[];
} {
  const uploadFeito: PlataformaResposta[] = [];
  const somenteZernio: PlataformaResposta[] = [];
  for (const p of plats) {
    const temUrlOuId = Boolean(p.platformPostUrl || p.platformPostId);
    if (p.status === 'published' || temUrlOuId) uploadFeito.push(p);
    else somenteZernio.push(p);
  }
  return { uploadFeito, somenteZernio };
}

export async function cancelarAgendamento(
  tenant: TenantConfig,
  pageId: string,
  onLog: (msg: string) => void = (m) => console.log(m),
): Promise<void> {
  const notion = notionDo(tenant);
  const zernio = zernioDo(tenant);

  const page = await notion.pages.retrieve({ page_id: pageId });
  if (!('properties' in page)) throw new Error('Página sem properties.');
  const props = page.properties;

  const nome = lerTitle(props['Nome']) || '(sem nome)';
  const status = lerStatus(props['Status']);
  const zernioPostId = lerRichText(props['ZernioPostId']);

  onLog(`Página: ${nome}`);
  onLog(`  status atual: ${status || '(vazio)'}`);
  onLog(`  ZernioPostId: ${zernioPostId || '(vazio)'}`);

  if (!zernioPostId) {
    onLog('Nenhum ZernioPostId — não há agendamento pra cancelar.');
    return;
  }

  onLog('\nLendo post no Zernio...');
  const resp = await zernio.posts.getPost({ path: { postId: zernioPostId } });
  const data = (resp as {
    data?: { post?: { platforms?: PlataformaResposta[]; status?: string } };
    error?: { message?: string; status?: number };
  });

  if (data.error) {
    onLog(`Zernio retornou erro: ${data.error.message ?? JSON.stringify(data.error)}`);
    onLog('Provavelmente já foi cancelado/deletado. Atualizando Notion mesmo assim.');
  }

  const platforms = data.data?.post?.platforms ?? [];
  const { uploadFeito, somenteZernio } = classificarPlataformas(platforms);

  onLog(`\nPlataformas no post:`);
  for (const p of platforms) {
    const marcador = p.platformPostUrl || p.platformPostId ? '🔴 upload feito' : '🟡 só no Zernio';
    onLog(`  ${marcador} ${p.platform} — status=${p.status}${p.platformPostUrl ? ` url=${p.platformPostUrl}` : ''}`);
  }

  onLog('\nChamando deletePost no Zernio...');
  try {
    const del = await zernio.posts.deletePost({ path: { postId: zernioPostId } });
    const erroDel = (del as { error?: { message?: string } }).error;
    if (erroDel) onLog(`  ⚠️  Zernio: ${erroDel.message ?? JSON.stringify(erroDel)}`);
    else onLog('  ✅ Zernio cancelou.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onLog(`  ⚠️  exceção ao deletar no Zernio: ${msg}`);
  }

  let nota = '';
  if (uploadFeito.length > 0) {
    const redes = uploadFeito.map((p) => p.platform).filter(Boolean).join(', ');
    nota = `⚠️ Cancelado no Zernio em ${new Date().toISOString()}, mas ${redes} já tinha(m) upload feito. Precisa deletar manualmente:\n`;
    for (const p of uploadFeito) {
      if (p.platform === 'youtube') {
        nota += `- YouTube Studio: https://studio.youtube.com/  (vídeo: ${p.platformPostUrl ?? p.platformPostId ?? '?'})\n`;
      } else if (p.platform === 'instagram') {
        nota += `- Instagram app/Meta Business Suite: ${p.platformPostUrl ?? '(post ' + p.platformPostId + ')'}\n`;
      } else if (p.platform === 'tiktok') {
        nota += `- TikTok app: ${p.platformPostUrl ?? '(post ' + p.platformPostId + ')'}\n`;
      } else if (p.platform === 'linkedin') {
        nota += `- LinkedIn: ${p.platformPostUrl ?? '(post ' + p.platformPostId + ')'}\n`;
      }
    }
  } else {
    nota = `Cancelado no Zernio em ${new Date().toISOString()}. Nenhuma rede tinha upload feito.`;
  }

  const resumoAntes = lerRichText(props['Resumo']);
  const resumoNovo = resumoAntes ? `${resumoAntes}\n\n— CANCELAMENTO —\n${nota}` : nota;

  onLog('\nAtualizando Notion (Status=Cancelado + nota)...');
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: { select: { name: 'Cancelado' } },
      Resumo: { rich_text: chunkRichText(resumoNovo) },
    } as never,
  });
  onLog('  ✅ Notion atualizado.');

  if (uploadFeito.length > 0) {
    onLog('');
    onLog('═══════════════════════════════════════════════════════════');
    onLog('⚠️  ATENÇÃO: redes abaixo precisam de DELETE MANUAL agora:');
    for (const p of uploadFeito) {
      onLog(`  • ${p.platform}${p.platformPostUrl ? ' → ' + p.platformPostUrl : ''}`);
    }
    onLog('═══════════════════════════════════════════════════════════');
    if (somenteZernio.length > 0) {
      const ok = somenteZernio.map((p) => p.platform).filter(Boolean).join(', ');
      onLog(`(${ok} estava só no Zernio — cancelado de verdade.)`);
    }
  } else {
    onLog('Cancelamento limpo: nenhuma rede tinha upload pendente.');
  }
}
