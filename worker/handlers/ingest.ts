import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { baixarDoR2 } from '@/src/storage/r2';
import { extrairFrames, extrairFramesPorCena } from '@/src/ingest/extrairFrames';
import { transcreverVideo, type Transcricao } from '@/src/ingest/transcricao';
import { ehImagem, ehVideo } from '@/src/ingest/parseNome';
import { lerImagemComoFrame } from '@/src/ingest/lerImagem';
import { gerarPlanoComInferencia } from '@/src/brain/cerebro';
import { polirCopy } from '@/src/brain/redator';
import { globalConfig } from '@/src/config';
import { gerarThumbnailDoVideoLocal } from '@/src/brain/gerarThumbnail';
import { criarLinhaAprovacao } from '@/src/approval/notion';
import { loadTenantConfigById } from '@/src/db/tenantConfig';
import { filtrarRedesPorTamanho } from '@/src/brain/limitesRede';
import type { Orientacao, Rede } from '@/src/types';

const exec = promisify(execFile);

// Vídeos com tamanho >= LIMIAR_STREAM_BYTES não são baixados pro /tmp — ffmpeg
// lê direto da URL R2 via range requests. Pra 1GB+ no Railway hobby tier
// (RAM ~512MB-1GB), baixar inteiro estoura OOM ou disco. Streaming usa só
// memória dos chunks necessários (poucos MB).
const LIMIAR_STREAM_BYTES = 200 * 1024 * 1024;

async function detectarOrientacao(input: string): Promise<Orientacao> {
  try {
    const { stdout } = await exec('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0',
      input,
    ], { timeout: 30_000 });
    const [wStr, hStr] = stdout.trim().split(',');
    const w = parseInt(wStr, 10);
    const h = parseInt(hStr, 10);
    return w >= h ? 'h' : 'v';
  } catch {
    return 'h';
  }
}

export interface PayloadIngest {
  chaveR2: string;
  urlPublica: string;
  nomeArquivo: string;
  /** Tamanho em bytes (browser passa via FileReader). Usado pra decidir
   * stream vs download e pra filtrar redes que não aceitam o tamanho. */
  tamanhoBytes?: number;
  /**
   * Carrossel: imagens EXTRAS (a 1ª fica nos campos acima). Cada uma já foi
   * uploaded no R2 pelo client antes de criar o job. Worker baixa todas pra
   * ler como frames e gravar urls em plano.mediasExtras.
   */
  extras?: Array<{ chaveR2: string; urlPublica: string; nomeArquivo: string }>;
}

export interface ResultadoIngest {
  pageId: string;
  notionUrl: string;
  cliente: string;
  tipo: string;
  thumbnailUrl?: string;
}

export async function processarIngest(
  empresaId: number,
  payload: PayloadIngest,
  log: (msg: string) => void,
): Promise<ResultadoIngest> {
  const tenant = await loadTenantConfigById(empresaId);
  const ehFoto = ehImagem(payload.nomeArquivo);
  const ehCarrossel = (payload.extras?.length ?? 0) > 0;
  const tamanho = payload.tamanhoBytes ?? 0;

  // Pra vídeo grande, NÃO baixa — ffmpeg lê direto da URL via range requests.
  // Pra imagem ou vídeo pequeno, baixa pro /tmp (mais rápido em sucessivas
  // chamadas de ffmpeg pra extrair 6 frames + thumbnail).
  const streamarDaUrl = !ehFoto && !ehCarrossel && tamanho >= LIMIAR_STREAM_BYTES;
  let baixado: Awaited<ReturnType<typeof baixarDoR2>> | null = null;
  let inputFfmpeg: string;
  if (streamarDaUrl) {
    log(`vídeo grande (${(tamanho / 1024 / 1024).toFixed(0)}MB) — ffmpeg lê direto da URL R2.`);
    inputFfmpeg = payload.urlPublica;
  } else if (ehFoto || tamanho > 0) {
    log(`baixando ${payload.chaveR2} do R2...`);
    baixado = await baixarDoR2(payload.chaveR2, payload.nomeArquivo);
    inputFfmpeg = baixado.caminho;
  } else {
    // Sem tamanho (payload antigo): default ao comportamento anterior.
    log(`baixando ${payload.chaveR2} do R2 (sem tamanho conhecido)...`);
    baixado = await baixarDoR2(payload.chaveR2, payload.nomeArquivo);
    inputFfmpeg = baixado.caminho;
  }

  // Carrossel sempre baixa (imagens são pequenas, e ffmpeg/sharp precisa do
  // arquivo pra ler como frame).
  const baixadosExtras: Array<Awaited<ReturnType<typeof baixarDoR2>>> = [];
  if (payload.extras && payload.extras.length > 0) {
    log(`baixando ${payload.extras.length} imagem(ns) extra(s) do carrossel...`);
    for (const ex of payload.extras) {
      const b = await baixarDoR2(ex.chaveR2, ex.nomeArquivo);
      baixadosExtras.push(b);
    }
  }

  try {
    log(`ffprobe pra orientação + ${ehCarrossel ? `lendo ${1 + (payload.extras?.length ?? 0)} imagens (carrossel)` : ehFoto ? 'lendo imagem (foto)' : 'extração de frames por cena'}...`);
    const inputPrincipal = baixado?.caminho ?? inputFfmpeg;
    const [orientacao, framePrincipal] = await Promise.all([
      detectarOrientacao(inputFfmpeg),
      ehFoto
        ? lerImagemComoFrame(inputPrincipal)
        : extrairFramesPorCena(inputFfmpeg, 12).then((fs) => fs),
    ]);
    const frames = ehCarrossel
      ? [
          framePrincipal as Awaited<ReturnType<typeof lerImagemComoFrame>>,
          ...(await Promise.all(baixadosExtras.map((b) => lerImagemComoFrame(b.caminho)))),
        ]
      : Array.isArray(framePrincipal)
        ? framePrincipal
        : [framePrincipal];

    // Transcrição do áudio (best-effort, nunca bloqueia o pipeline).
    // Passa `inputFfmpeg` (arquivo local se baixamos, ou URL R2 direto se
    // é streaming) — o ffmpeg dentro de transcreverVideo aceita ambos e
    // no modo URL só baixa a trilha de áudio (bem menor que o vídeo).
    let transcricao: Transcricao | null = null;
    if (globalConfig.GROQ_API_KEY && !ehFoto && !ehCarrossel) {
      try {
        log('transcrição: extraindo áudio + Groq Whisper turbo...');
        transcricao = await transcreverVideo(inputFfmpeg, globalConfig.GROQ_API_KEY);
        if (transcricao) {
          const previa = transcricao.texto.slice(0, 90).replace(/\n/g, ' ');
          log(`transcrição: "${previa}${transcricao.texto.length > 90 ? '…' : ''}"`);
        } else {
          log('transcrição: sem áudio detectado ou vídeo grande demais.');
        }
      } catch (err) {
        log(`transcrição falhou (ignorando): ${err instanceof Error ? err.message : err}`);
      }
    }

    log('cérebro: inferindo cliente/tipo + gerando copy...');
    const planoBruto = await gerarPlanoComInferencia(
      {
        pastaPaiNome: 'upload-web',
        caminhoPastas: 'upload-web',
        nomeArquivo: payload.nomeArquivo,
        orientacao,
        caminhoLocal: inputPrincipal,
      },
      frames,
      transcricao,
    );
    if (ehCarrossel) {
      planoBruto.meta.tipo = 'carrossel';
    }

    // Filtra redes que não aceitam o tamanho do vídeo (ex: TikTok >287MB).
    if (!ehFoto && tamanho > 0) {
      const { redes: redesFiltradas, removidas } = filtrarRedesPorTamanho(
        planoBruto.redes as Rede[],
        tamanho,
      );
      if (removidas.length > 0) {
        log(`redes removidas por tamanho (${(tamanho / 1024 / 1024).toFixed(0)}MB): ${removidas.join(', ')}`);
        planoBruto.redes = redesFiltradas;
        planoBruto.copy = planoBruto.copy.filter((c) => redesFiltradas.includes(c.rede));
      }
    }

    log(`   cliente=${planoBruto.meta.cliente} tipo=${planoBruto.meta.tipo} redes=${planoBruto.redes.join(',')}`);

    log('redator: polindo no tom da marca...');
    const planoPolido = await polirCopy(planoBruto, frames, tenant.tomVoz, transcricao);

    let plano = planoPolido;
    if (ehCarrossel) {
      plano = {
        ...planoPolido,
        mediasExtras: (payload.extras ?? []).map((e) => ({
          urlPublica: e.urlPublica,
          chaveR2: e.chaveR2,
        })),
      };
      log(`carrossel: ${plano.mediasExtras?.length ?? 0} mídia(s) extra(s) anexada(s) ao plano.`);
    } else if (!ehFoto) {
      // Thumbnail: se baixamos o vídeo, ffmpeg lê do arquivo local. Em modo
      // streaming (>200MB), ffmpeg lê da URL do R2 direto — mais lento, mas
      // funciona com HTTP range requests. Se falhar, seguimos sem thumbnail
      // e o Zernio pega um frame arbitrário do vídeo.
      const inputThumb = baixado?.caminho ?? inputFfmpeg;
      try {
        const thumb = await gerarThumbnailDoVideoLocal(tenant, inputThumb, planoPolido, (msg) =>
          log(`   ${msg}`),
        );
        plano = { ...planoPolido, thumbnailUrl: thumb.thumbnailUrl };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`thumbnail falhou (sigo sem): ${msg}`);
      }
    } else {
      log('foto: imagem é a própria thumb, pulo agent de thumbnail.');
    }

    log('criando linha no Notion...');
    const linha = await criarLinhaAprovacao(tenant, plano, {
      urlPublica: payload.urlPublica,
      chaveR2: payload.chaveR2,
    });

    log(`pronto: ${linha.url}`);

    return {
      pageId: linha.pageId,
      notionUrl: linha.url,
      cliente: planoPolido.meta.cliente,
      tipo: planoPolido.meta.tipo,
      thumbnailUrl: plano.thumbnailUrl,
    };
  } finally {
    if (baixado) await baixado.limpar().catch(() => {});
    await Promise.all(baixadosExtras.map((b) => b.limpar().catch(() => {})));
    void path;
  }
}
