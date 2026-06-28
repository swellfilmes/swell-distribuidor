import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { notionDo } from '../lib/clients';
import { extrairFrames } from '../ingest/extrairFrames';
import { gerarPlanoComInferencia } from '../brain/cerebro';
import { polirCopy } from '../brain/redator';
import { gerarThumbnailDoVideoLocal } from '../brain/gerarThumbnail';
import { chunkRichText } from '../lib/notionChunks';
import { subirParaR2 } from '../storage/r2';
import { notionDbIdDo, type TenantConfig } from '../config';
import type { Orientacao, PlanoPublicacao } from '../types';

const exec = promisify(execFile);

const EXTENSOES_VIDEO = new Set([
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.webm',
  '.m4v',
  '.mpeg',
  '.mpg',
]);

interface VideoLocal {
  caminhoAbsoluto: string;
  nomeArquivo: string;
  pastaPaiNome: string;
  caminhoPastas: string;
  tamanhoBytes: number;
  /** Hash determinístico baseado no caminho absoluto, pra idempotência. */
  sourceId: string;
}

async function listarVideosLocal(
  pastaRaiz: string,
  onProgress?: (msg: string) => void,
): Promise<VideoLocal[]> {
  const videos: VideoLocal[] = [];

  async function walk(dir: string, caminhoRelativo: string) {
    onProgress?.(`vasculhando: ${caminhoRelativo}`);
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full, `${caminhoRelativo}/${e.name}`);
        continue;
      }
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (!EXTENSOES_VIDEO.has(ext)) continue;
      const s = await stat(full);
      const sourceId = createHash('sha1').update(full).digest('hex').slice(0, 24);
      videos.push({
        caminhoAbsoluto: full,
        nomeArquivo: e.name,
        pastaPaiNome: path.basename(dir),
        caminhoPastas: caminhoRelativo,
        tamanhoBytes: s.size,
        sourceId,
      });
    }
  }

  const nomeRaiz = path.basename(path.resolve(pastaRaiz));
  await walk(path.resolve(pastaRaiz), nomeRaiz);
  return videos;
}

async function jaIngerido(
  tenant: TenantConfig,
  sourceId: string,
): Promise<boolean> {
  const notion = notionDo(tenant);
  const resp = await notion.databases.query({
    database_id: notionDbIdDo(tenant),
    filter: {
      property: 'DriveFileId',
      rich_text: { equals: sourceId },
    },
    page_size: 1,
  });
  return resp.results.length > 0;
}

async function detectarOrientacao(caminhoVideo: string): Promise<Orientacao> {
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
}

async function criarLinha(
  tenant: TenantConfig,
  plano: PlanoPublicacao,
  videoR2: string,
  sourceId: string,
  pastaOrigem: string,
): Promise<void> {
  const notion = notionDo(tenant);
  const tituloLinha = `${plano.meta.cliente} — ${plano.meta.tipo} — ${plano.meta.nomeArquivo}`;
  const copyResumo = plano.copy.map((c) => `[${c.rede}] ${c.descricao}`).join('\n\n');
  const planoJson = JSON.stringify(plano);

  const props: Record<string, unknown> = {
    Nome: { title: [{ text: { content: tituloLinha } }] },
    Cliente: { rich_text: [{ text: { content: plano.meta.cliente } }] },
    Tipo: { select: { name: plano.meta.tipo } },
    Orientacao: { select: { name: plano.meta.orientacao } },
    Status: { select: { name: 'Aguardando' } },
    Redes: { multi_select: plano.redes.map((r) => ({ name: r })) },
    ConteudoAI: { checkbox: plano.conteudoAI },
    Video: { url: videoR2 },
    Resumo: { rich_text: [{ text: { content: plano.resumoInterno } }] },
    Copy: { rich_text: chunkRichText(copyResumo) },
    PlanoJSON: { rich_text: chunkRichText(planoJson) },
    DriveFileId: { rich_text: [{ text: { content: sourceId } }] },
    PastaDrive: { rich_text: [{ text: { content: pastaOrigem } }] },
  };
  if (plano.thumbnailUrl) {
    props.ThumbnailUrl = { url: plano.thumbnailUrl };
  }

  await notion.pages.create({
    parent: { database_id: notionDbIdDo(tenant) },
    properties: props as never,
  });
}

async function processarUmVideo(
  tenant: TenantConfig,
  v: VideoLocal,
  onLog: (msg: string) => void,
): Promise<'ok' | 'pulado' | 'falhou'> {
  if (await jaIngerido(tenant, v.sourceId)) {
    onLog(`  ⏭️  já ingerido antes; pulando.`);
    return 'pulado';
  }

  onLog(`  🔍  ffprobe + 6 frames...`);
  const orientacao = await detectarOrientacao(v.caminhoAbsoluto);
  const frames = await extrairFrames(v.caminhoAbsoluto, 6);

  onLog(`  🧠  cérebro (Sonnet 4.6) inferindo cliente/tipo + copy...`);
  const planoBruto = await gerarPlanoComInferencia(
    {
      pastaPaiNome: v.pastaPaiNome,
      caminhoPastas: v.caminhoPastas,
      nomeArquivo: v.nomeArquivo,
      orientacao,
      caminhoLocal: v.caminhoAbsoluto,
    },
    frames,
  );
  onLog(`    cliente=${planoBruto.meta.cliente} tipo=${planoBruto.meta.tipo} redes=${planoBruto.redes.join(',')}`);

  onLog(`  ✍️   redator polindo copy no tom Swell...`);
  const planoPolido = await polirCopy(planoBruto, frames);

  let plano = planoPolido;
  try {
    const thumb = await gerarThumbnailDoVideoLocal(tenant, v.caminhoAbsoluto, planoPolido, (msg) =>
      onLog(`  ${msg}`),
    );
    plano = { ...planoPolido, thumbnailUrl: thumb.thumbnailUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onLog(`  ⚠️  thumbnail falhou (sigo sem): ${msg}`);
  }

  onLog(`  ☁️  subindo vídeo no R2...`);
  const midia = await subirParaR2(tenant, v.caminhoAbsoluto);

  onLog(`  📝  criando linha no Notion...`);
  await criarLinha(tenant, plano, midia.urlPublica, v.sourceId, v.caminhoPastas);

  onLog(`  ✅  ingerido.`);
  return 'ok';
}

export async function ingerirPasta(
  tenant: TenantConfig,
  caminhoPasta: string,
  opts: { max?: number; apenasListar?: boolean; ignorar?: string[] } = {},
  onLog: (msg: string) => void = (m) => console.log(m),
): Promise<void> {
  onLog(`Varrendo pasta local: ${path.resolve(caminhoPasta)}`);

  const todos = await listarVideosLocal(caminhoPasta, (msg) => onLog(`  ${msg}`));
  onLog(`\nEncontrados ${todos.length} vídeo(s) no total.`);

  const ignorarTermos = (opts.ignorar ?? []).map((s) => s.toLowerCase());
  let videos = todos;
  if (ignorarTermos.length) {
    videos = videos.filter((v) => {
      const alvo = `${v.caminhoPastas}/${v.nomeArquivo}`.toLowerCase();
      return !ignorarTermos.some((t) => alvo.includes(t));
    });
    const removidos = todos.length - videos.length;
    if (removidos > 0) {
      onLog(`(ignorados ${removidos} arquivo(s) por --ignorar [${ignorarTermos.join(', ')}]).`);
    }
  }

  if (opts.max) {
    videos = videos.slice(0, opts.max);
    if (videos.length < todos.length - ignorarTermos.length) {
      onLog(`(limitando a ${opts.max} primeiros por causa do --max).`);
    }
  }

  if (opts.apenasListar) {
    onLog('\nApenas listando (--apenas-listar). Lista:');
    for (const v of videos) {
      const mb = (v.tamanhoBytes / 1024 / 1024).toFixed(1);
      onLog(`  ${v.caminhoPastas}/${v.nomeArquivo}  (${mb} MB)`);
    }
    return;
  }

  let ingeridos = 0;
  let pulados = 0;
  let falhas = 0;

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const mb = (v.tamanhoBytes / 1024 / 1024).toFixed(1);
    onLog(`\n[${i + 1}/${videos.length}] ${v.caminhoPastas}/${v.nomeArquivo} (${mb} MB)`);
    try {
      const r = await processarUmVideo(tenant, v, onLog);
      if (r === 'ok') ingeridos++;
      else if (r === 'pulado') pulados++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog(`  ❌ falhou: ${msg}`);
      falhas++;
    }
  }

  onLog(`\n═══════════════════════════════════════`);
  onLog(`FIM. ${ingeridos} ingerido(s), ${pulados} pulado(s), ${falhas} falha(s) de ${videos.length}.`);
  onLog(`═══════════════════════════════════════`);
}
