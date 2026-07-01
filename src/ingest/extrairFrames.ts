import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const exec = promisify(execFile);

// Timeouts pra impedir worker travado em ffmpeg que pendurou (ex: URL R2 lenta).
const FFPROBE_TIMEOUT_MS = 30_000;
const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000;

export interface FrameExtraido {
  timestampSeg: number;
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

async function obterDuracaoSeg(caminhoVideo: string): Promise<number> {
  const { stdout } = await exec('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    caminhoVideo,
  ], { timeout: FFPROBE_TIMEOUT_MS });
  const dur = parseFloat(stdout.trim());
  if (!Number.isFinite(dur) || dur <= 0) {
    throw new Error(`Não consegui ler a duração do vídeo (${caminhoVideo}).`);
  }
  return dur;
}

export async function extrairFrames(
  caminhoVideo: string,
  quantidade = 6,
  opts: { timestampsExplicitos?: number[] } = {},
): Promise<FrameExtraido[]> {
  let timestamps: number[];
  if (opts.timestampsExplicitos && opts.timestampsExplicitos.length > 0) {
    timestamps = opts.timestampsExplicitos;
  } else {
    const duracao = await obterDuracaoSeg(caminhoVideo);
    const passo = duracao / (quantidade + 1);
    timestamps = Array.from({ length: quantidade }, (_, i) => passo * (i + 1));
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'swell-frames-'));

  try {
    // Sequencial de propósito: 6 ffmpegs em paralelo cada um abre o vídeo
    // inteiro na memória, multiplicando o pico de RAM e estourando o
    // container do Railway. 1 por vez mantém o working set baixo.
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const out = path.join(tmpDir, `frame_${String(i).padStart(2, '0')}.jpg`);
      await exec('ffmpeg', [
        '-ss', ts.toFixed(2),
        '-i', caminhoVideo,
        '-frames:v', '1',
        '-vf', 'scale=640:-1',
        '-q:v', '3',
        '-y',
        out,
      ], { timeout: FFMPEG_TIMEOUT_MS });
    }

    const frames: FrameExtraido[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const out = path.join(tmpDir, `frame_${String(i).padStart(2, '0')}.jpg`);
      const buffer = await readFile(out);
      frames.push({
        timestampSeg: timestamps[i],
        base64: buffer.toString('base64'),
        mediaType: 'image/jpeg' as const,
      });
    }

    return frames;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Extrai frames com detecção de cena (`select=gt(scene,0.35)`). Só pega
 * momentos onde há mudança visual relevante — melhor pra copy do que os 6
 * frames uniformes tradicionais quando o vídeo tem cortes de edição.
 *
 * Trade-offs vs `extrairFrames`:
 *  - Decodifica o vídeo INTEIRO numa passada (mais CPU/RAM), timeout dobrado.
 *  - Quantidade final é desconhecida a priori — se passar de `maxFrames`,
 *    reamostra pra pegar 1º + intermediários espaçados + último.
 *  - Se detectar 0 cortes (drone contínuo, take único), CAI PRO FALLBACK
 *    `extrairFrames(caminho, 6)`.
 *
 * `timestampSeg` NÃO é confiável nesse modo (`-vsync vfr` reordena) — fica 0.
 * Isso não é usado pela copy nem pelo thumbnail HiRes (que extrai à parte).
 */
export async function extrairFramesPorCena(
  caminhoVideo: string,
  maxFrames = 12,
): Promise<FrameExtraido[]> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'swell-cenas-'));
  try {
    await exec(
      'ffmpeg',
      [
        '-i', caminhoVideo,
        '-vf', "select='gt(scene,0.35)',scale=640:-1",
        '-vsync', 'vfr',
        '-q:v', '3',
        '-y',
        path.join(tmpDir, 'cena_%03d.jpg'),
      ],
      { timeout: FFMPEG_TIMEOUT_MS * 2 },
    );

    const arquivos = (await readdir(tmpDir))
      .filter((f) => f.endsWith('.jpg'))
      .sort();

    if (arquivos.length === 0) {
      // Vídeo sem cortes detectados → fallback uniforme.
      return extrairFrames(caminhoVideo, 6);
    }

    // Se detectou frames demais, amostra: primeiro + N distribuídos + último.
    let selecionados: string[];
    if (arquivos.length <= maxFrames) {
      selecionados = arquivos;
    } else {
      const step = (arquivos.length - 1) / (maxFrames - 1);
      selecionados = Array.from({ length: maxFrames }, (_, i) =>
        arquivos[Math.round(i * step)],
      );
    }

    const frames: FrameExtraido[] = [];
    for (const nome of selecionados) {
      const buffer = await readFile(path.join(tmpDir, nome));
      frames.push({
        timestampSeg: 0,
        base64: buffer.toString('base64'),
        mediaType: 'image/jpeg' as const,
      });
    }
    return frames;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Extrai um frame único em alta resolução (1280px de largura) num arquivo
 * temporário e devolve o caminho + função pra apagar. Use pra gerar thumbnail
 * que vai ser hospedada em CDN.
 */
export async function extrairFrameHiRes(
  caminhoVideo: string,
  timestampSeg: number,
): Promise<{ caminhoArquivo: string; limpar: () => Promise<void> }> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'swell-thumb-'));
  const caminhoArquivo = path.join(tmpDir, `thumb_${Math.floor(timestampSeg)}.jpg`);
  await exec('ffmpeg', [
    '-ss', timestampSeg.toFixed(2),
    '-i', caminhoVideo,
    '-frames:v', '1',
    '-vf', 'scale=1280:-1',
    '-q:v', '2',
    '-y',
    caminhoArquivo,
  ], { timeout: FFMPEG_TIMEOUT_MS });
  return {
    caminhoArquivo,
    limpar: async () => rm(tmpDir, { recursive: true, force: true }),
  };
}
