import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { baixarDoR2 } from '@/src/storage/r2';
import { extrairFrames } from '@/src/ingest/extrairFrames';
import { ehImagem } from '@/src/ingest/parseNome';
import { lerImagemComoFrame } from '@/src/ingest/lerImagem';
import { gerarPlanoComInferencia } from '@/src/brain/cerebro';
import { polirCopy } from '@/src/brain/redator';
import { gerarThumbnailDoVideoLocal } from '@/src/brain/gerarThumbnail';
import { criarLinhaAprovacao } from '@/src/approval/notion';
import { loadTenantConfigById } from '@/src/db/tenantConfig';
import type { Orientacao } from '@/src/types';

const exec = promisify(execFile);

async function detectarOrientacao(caminhoVideo: string): Promise<Orientacao> {
  try {
    const { stdout } = await exec('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0',
      caminhoVideo,
    ]);
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
  log(`⬇️  baixando ${payload.chaveR2} do R2...`);
  const tenant = await loadTenantConfigById(empresaId);
  const baixado = await baixarDoR2(payload.chaveR2, payload.nomeArquivo);

  // Carrossel: baixa também os extras pra usar como frames adicionais no cérebro.
  const baixadosExtras: Array<Awaited<ReturnType<typeof baixarDoR2>>> = [];
  if (payload.extras && payload.extras.length > 0) {
    log(`⬇️  baixando ${payload.extras.length} imagem(ns) extra(s) do carrossel...`);
    for (const ex of payload.extras) {
      const b = await baixarDoR2(ex.chaveR2, ex.nomeArquivo);
      baixadosExtras.push(b);
    }
  }

  try {
    const ehFoto = ehImagem(payload.nomeArquivo);
    const ehCarrossel = (payload.extras?.length ?? 0) > 0;
    log(`🔍 ffprobe pra orientação + ${ehCarrossel ? `lendo ${1 + (payload.extras?.length ?? 0)} imagens (carrossel)` : ehFoto ? 'lendo imagem (foto)' : 'extração de 6 frames'}...`);
    const [orientacao, framePrincipal] = await Promise.all([
      detectarOrientacao(baixado.caminho),
      ehFoto
        ? lerImagemComoFrame(baixado.caminho)
        : extrairFrames(baixado.caminho, 6).then((fs) => fs),
    ]);
    const frames = ehCarrossel
      ? [
          framePrincipal as Awaited<ReturnType<typeof lerImagemComoFrame>>,
          ...(await Promise.all(baixadosExtras.map((b) => lerImagemComoFrame(b.caminho)))),
        ]
      : Array.isArray(framePrincipal)
        ? framePrincipal
        : [framePrincipal];

    log('🧠 cérebro: inferindo cliente/tipo + gerando copy...');
    const planoBruto = await gerarPlanoComInferencia(
      {
        pastaPaiNome: 'upload-web',
        caminhoPastas: 'upload-web',
        nomeArquivo: payload.nomeArquivo,
        orientacao,
        caminhoLocal: baixado.caminho,
      },
      frames,
    );
    // Carrossel: força tipo na meta (cérebro pode chutar errado em batch)
    if (ehCarrossel) {
      planoBruto.meta.tipo = 'carrossel';
    }
    log(`   cliente=${planoBruto.meta.cliente} tipo=${planoBruto.meta.tipo} redes=${planoBruto.redes.join(',')}`);

    log('✍️  redator: polindo no tom Swell...');
    const planoPolido = await polirCopy(planoBruto, frames);

    let plano = planoPolido;
    if (ehCarrossel) {
      // Anexa URLs das imagens extras no plano pra publicação juntá-las no Zernio.
      plano = {
        ...planoPolido,
        mediasExtras: (payload.extras ?? []).map((e) => ({
          urlPublica: e.urlPublica,
          chaveR2: e.chaveR2,
        })),
      };
      log(`🎠 carrossel: ${plano.mediasExtras?.length ?? 0} mídia(s) extra(s) anexada(s) ao plano.`);
    } else if (!ehFoto) {
      try {
        const thumb = await gerarThumbnailDoVideoLocal(tenant, baixado.caminho, planoPolido, (msg) =>
          log(`   ${msg}`),
        );
        plano = { ...planoPolido, thumbnailUrl: thumb.thumbnailUrl };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`⚠️  thumbnail falhou (sigo sem): ${msg}`);
      }
    } else {
      log('🖼️  foto: imagem é a própria thumb, pulo agent de thumbnail.');
    }

    log('📝 criando linha no Notion...');
    const linha = await criarLinhaAprovacao(tenant, plano, {
      urlPublica: payload.urlPublica,
      chaveR2: payload.chaveR2,
    });

    log(`✅ pronto: ${linha.url}`);

    return {
      pageId: linha.pageId,
      notionUrl: linha.url,
      cliente: planoPolido.meta.cliente,
      tipo: planoPolido.meta.tipo,
      thumbnailUrl: plano.thumbnailUrl,
    };
  } finally {
    await baixado.limpar().catch(() => {});
    await Promise.all(baixadosExtras.map((b) => b.limpar().catch(() => {})));
    void path;
  }
}
