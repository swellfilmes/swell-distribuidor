import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { baixarDoR2 } from '@/src/storage/r2';
import { extrairFrames } from '@/src/ingest/extrairFrames';
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

  try {
    log('🔍 ffprobe pra orientação + extração de 6 frames...');
    const [orientacao, frames] = await Promise.all([
      detectarOrientacao(baixado.caminho),
      extrairFrames(baixado.caminho, 6),
    ]);

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
    log(`   cliente=${planoBruto.meta.cliente} tipo=${planoBruto.meta.tipo} redes=${planoBruto.redes.join(',')}`);

    log('✍️  redator: polindo no tom Swell...');
    const planoPolido = await polirCopy(planoBruto, frames);

    let plano = planoPolido;
    try {
      const thumb = await gerarThumbnailDoVideoLocal(tenant, baixado.caminho, planoPolido, (msg) =>
        log(`   ${msg}`),
      );
      plano = { ...planoPolido, thumbnailUrl: thumb.thumbnailUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`⚠️  thumbnail falhou (sigo sem): ${msg}`);
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
    void path;
  }
}
