import { notionDo, zernioDo } from '../lib/clients';
import { deletarDoR2, chaveR2DeUrl } from '../storage/r2';
import { comTimeoutERetry } from '../lib/resiliencia';
import type { TenantConfig } from '../config';
import type { PlanoPublicacao } from '../types';

function lerRichText(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; rich_text?: Array<{ plain_text?: string }> };
  if (p.type !== 'rich_text' || !p.rich_text) return '';
  return p.rich_text.map((t) => t.plain_text ?? '').join('').trim();
}

function lerUrl(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; url?: string | null };
  if (p.type !== 'url' || !p.url) return '';
  return p.url;
}

function lerStatus(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; select?: { name?: string } | null };
  if (p.type !== 'select' || !p.select?.name) return '';
  return p.select.name;
}

export interface ResumoExclusao {
  /** True se Notion arquivou a página. */
  notionArquivado: boolean;
  /** True se pelo menos um objeto R2 foi deletado (vídeo, thumb ou extras). */
  r2Removido: boolean;
  /** Zernio postId cancelado. Null se não havia agendamento. */
  zernioCancelado: string | null;
  /** Redes que já tinham upload feito no momento da exclusão — pra avisar
   *  o usuário de deletar manualmente na plataforma. */
  redesJaPublicadas: string[];
  /** Warnings soft (não fatais) que o caller pode mostrar. */
  avisos: string[];
}

interface PlatformaResposta {
  platform?: string;
  status?: string;
  platformPostUrl?: string;
  platformPostId?: string;
}

/**
 * Exclui um post inteiro:
 *   1. Cancela agendamento no Zernio (se houver e ainda não estiver publicado).
 *   2. Deleta vídeo/foto + thumbnail + extras do R2.
 *   3. Arquiva a página no Notion (Notion não tem hard delete via API).
 *
 * Best-effort: se uma etapa falhar (ex: R2 offline), continua com as outras.
 * Só lança se o próprio Notion não conseguir arquivar — nesse caso o post
 * segue visível pro usuário, com aviso.
 */
export async function excluirPost(
  tenant: TenantConfig,
  pageId: string,
  onLog: (msg: string) => void = () => {},
): Promise<ResumoExclusao> {
  const notion = notionDo(tenant);
  const resumo: ResumoExclusao = {
    notionArquivado: false,
    r2Removido: false,
    zernioCancelado: null,
    redesJaPublicadas: [],
    avisos: [],
  };

  onLog('Lendo página no Notion...');
  const page = await notion.pages.retrieve({ page_id: pageId });
  if (!('properties' in page)) {
    throw new Error('Página Notion inválida (sem propriedades).');
  }
  const props = page.properties;

  const zernioPostId = lerRichText(props['ZernioPostId']);
  const videoUrl = lerUrl(props['Video']);
  const thumbnailUrl = lerUrl(props['ThumbnailUrl']);
  const status = lerStatus(props['Status']);

  // 1. Zernio: cancela se tiver agendamento vivo.
  // Marker PROCESSING-<ts> é lock interno, não é postId Zernio — ignora.
  const temZernioReal = zernioPostId && !zernioPostId.startsWith('PROCESSING-');
  if (temZernioReal) {
    try {
      onLog(`Cancelando post no Zernio (${zernioPostId})...`);
      const zernio = zernioDo(tenant);
      // Descobre quais redes já estão publicadas — deletePost no Zernio
      // NÃO remove upload já feito (ex: YouTube publica na hora do agendamento).
      try {
        const resp = await comTimeoutERetry(
          () => zernio.posts.getPost({ path: { postId: zernioPostId } }),
          { nome: 'Zernio.getPost.excluir', timeoutMs: 20_000, tentativas: 2 },
        );
        const platforms =
          ((resp as { data?: { post?: { platforms?: PlatformaResposta[] } } }).data
            ?.post?.platforms as PlatformaResposta[] | undefined) ?? [];
        for (const p of platforms) {
          const temUploadReal = p.status === 'published' || p.platformPostUrl || p.platformPostId;
          if (temUploadReal && p.platform) {
            resumo.redesJaPublicadas.push(p.platform);
          }
        }
      } catch {
        // Zernio pode ter apagado o post já — segue.
      }
      await comTimeoutERetry(
        () => zernio.posts.deletePost({ path: { postId: zernioPostId } }),
        { nome: 'Zernio.deletePost', timeoutMs: 20_000, tentativas: 2 },
      );
      resumo.zernioCancelado = zernioPostId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      resumo.avisos.push(`Zernio não confirmou cancelamento (${msg}). O post pode continuar agendado.`);
    }
  }

  // 2. R2: deleta vídeo, thumbnail e extras do carrossel.
  const chavesR2: string[] = [];
  const chVideo = chaveR2DeUrl(videoUrl);
  if (chVideo) chavesR2.push(chVideo);
  const chThumb = chaveR2DeUrl(thumbnailUrl);
  if (chThumb && chThumb !== chVideo) chavesR2.push(chThumb);

  // Carrossel: PlanoJSON pode ter mediasExtras (fotos adicionais).
  try {
    const planoJsonStr = lerRichText(props['PlanoJSON']);
    if (planoJsonStr) {
      const plano = JSON.parse(planoJsonStr) as PlanoPublicacao & {
        mediasExtras?: Array<{ chaveR2?: string; urlPublica?: string }>;
      };
      for (const extra of plano.mediasExtras ?? []) {
        const chExtra = extra.chaveR2 || chaveR2DeUrl(extra.urlPublica);
        if (chExtra) chavesR2.push(chExtra);
      }
    }
  } catch {
    // PlanoJSON inválido — segue sem os extras.
  }

  if (chavesR2.length > 0) {
    onLog(`Deletando ${chavesR2.length} arquivo(s) do R2...`);
    for (const ch of chavesR2) {
      await deletarDoR2(ch);
    }
    resumo.r2Removido = true;
  }

  // 3. Notion: arquiva. Sem hard delete via API.
  onLog('Arquivando página no Notion...');
  await notion.pages.update({
    page_id: pageId,
    archived: true,
  } as never);
  resumo.notionArquivado = true;

  onLog(
    `Concluído. status_antes=${status || '?'} zernio=${resumo.zernioCancelado ? 'cancelado' : 'sem agendamento'} r2=${resumo.r2Removido ? 'limpo' : 'nada'}`,
  );
  if (resumo.redesJaPublicadas.length > 0) {
    onLog(
      `⚠️ Redes que já tinham upload feito: ${resumo.redesJaPublicadas.join(', ')}. Delete manualmente na plataforma.`,
    );
  }
  return resumo;
}
