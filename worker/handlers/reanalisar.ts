import { notionDo } from '@/src/lib/clients';
import { extrairFramesPorCena } from '@/src/ingest/extrairFrames';
import { transcreverVideo, type Transcricao } from '@/src/ingest/transcricao';
import { gerarPlano } from '@/src/brain/cerebro';
import { polirCopy } from '@/src/brain/redator';
import { chunkRichText } from '@/src/lib/notionChunks';
import { loadTenantConfigById } from '@/src/db/tenantConfig';
import { globalConfig } from '@/src/config';
import type {
  MetaArquivo,
  Orientacao,
  PlanoPublicacao,
  Rede,
  TipoVideo,
} from '@/src/types';

/**
 * Job de reanálise: pega uma linha "Aguardando" do Notion, roda o
 * pipeline atualizado (frames por cena + transcrição Groq + tom de voz
 * personalizado) e sobrescreve Copy + PlanoJSON. NÃO mexe em thumbnail,
 * status, redes ou data — só a legenda.
 *
 * Difere do ingest normal:
 *  - Não faz upload de mídia (vídeo já está no R2)
 *  - Não cria linha nova no Notion (só atualiza)
 *  - Não gera thumbnail (post já tem uma se precisar)
 *  - Não faz classificação de cliente/tipo — usa o que já foi decidido
 */
export interface PayloadReanalisar {
  pageId: string;
}

export interface ResultadoReanalisar {
  pageId: string;
  cliente: string;
  tipo: string;
  usouTranscricao: boolean;
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

function lerUrl(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; url?: string | null };
  if (p.type !== 'url' || !p.url) return '';
  return p.url;
}

export async function processarReanalisar(
  empresaId: number,
  payload: PayloadReanalisar,
  log: (msg: string) => void,
): Promise<ResultadoReanalisar> {
  const tenant = await loadTenantConfigById(empresaId);
  const notion = notionDo(tenant);

  log('lendo página no Notion...');
  const page = await notion.pages.retrieve({ page_id: payload.pageId });
  if (!('properties' in page)) throw new Error('Página Notion sem propriedades.');
  const props = page.properties;

  const nome = lerTitle(props['Nome']) || '(sem nome)';
  const videoUrl = lerUrl(props['Video']);
  const cliente = lerRichText(props['Cliente']);
  const tipo = lerSelect(props['Tipo']) as TipoVideo;
  const orientacao = lerSelect(props['Orientacao']) as Orientacao;

  if (!videoUrl) throw new Error(`Post "${nome}" sem URL do vídeo.`);
  if (!cliente || !tipo || !orientacao) {
    throw new Error(`Post "${nome}" sem cliente/tipo/orientação preenchidos.`);
  }

  log(`post: ${nome}`);
  log(`meta: cliente=${cliente} tipo=${tipo} orientação=${orientacao}`);
  log(`vídeo: ${videoUrl}`);

  // Streaming direto da URL — não baixa o arquivo. Ffmpeg lê via range.
  log('ffmpeg: extraindo frames por cena direto da URL R2...');
  const frames = await extrairFramesPorCena(videoUrl, 12);
  log(`${frames.length} frames extraídos.`);

  // Transcrição do áudio (best-effort).
  let transcricao: Transcricao | null = null;
  if (globalConfig.GROQ_API_KEY) {
    try {
      log('transcrevendo áudio via Groq Whisper turbo...');
      transcricao = await transcreverVideo(videoUrl, globalConfig.GROQ_API_KEY);
      if (transcricao) {
        const previa = transcricao.texto.slice(0, 90).replace(/\n/g, ' ');
        log(`transcrição: "${previa}${transcricao.texto.length > 90 ? '…' : ''}"`);
      } else {
        log('sem áudio detectado ou vídeo grande demais — sigo sem transcrição.');
      }
    } catch (err) {
      log(`transcrição falhou (ignorando): ${err instanceof Error ? err.message : err}`);
    }
  } else {
    log('GROQ_API_KEY ausente — pulo transcrição.');
  }

  const meta: MetaArquivo = {
    cliente,
    tipo,
    orientacao,
    caminhoLocal: videoUrl,
    nomeArquivo: nome.split(' — ').pop() ?? nome,
  };

  log('cérebro: gerando copy com frames + transcrição + meta conhecida...');
  const planoBruto = await gerarPlano(meta, frames, transcricao);

  log('redator: polindo no tom da marca...');
  const planoPolido = await polirCopy(planoBruto, frames, tenant.tomVoz, transcricao);

  // Atualiza Copy + PlanoJSON — nada mais.
  const copyTextual = planoPolido.copy
    .map((c) => `[${c.rede}] ${c.descricao}`)
    .join('\n\n');
  const planoJson: PlanoPublicacao = { ...planoPolido, meta };

  await notion.pages.update({
    page_id: payload.pageId,
    properties: {
      Copy: { rich_text: chunkRichText(copyTextual) },
      PlanoJSON: { rich_text: chunkRichText(JSON.stringify(planoJson)) },
    } as never,
  });
  log('Notion atualizado (Copy + PlanoJSON).');

  // Consome `Rede` só pra typecheck saber que a var existe.
  void ({} as Rede);

  return {
    pageId: payload.pageId,
    cliente,
    tipo,
    usouTranscricao: Boolean(transcricao),
  };
}
