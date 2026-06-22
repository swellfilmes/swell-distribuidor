import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const exec = promisify(execFile);

export interface FrameExtraido {
  timestampSeg: number;
  base64: string;
  mediaType: 'image/jpeg';
}

async function obterDuracaoSeg(caminhoVideo: string): Promise<number> {
  const { stdout } = await exec('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    caminhoVideo,
  ]);
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
      ]);
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
  ]);
  return {
    caminhoArquivo,
    limpar: async () => rm(tmpDir, { recursive: true, force: true }),
  };
}
