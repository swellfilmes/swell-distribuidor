import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, stat, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const exec = promisify(execFile);

// Timeout do ffmpeg extraindo áudio. Vídeo longo pode levar 1-2min mesmo
// só remuxando o áudio, então 5min segura.
const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000;

// Groq aceita até 25MB por request. FLAC 16k mono ≈ 60% do WAV — vídeo
// institucional de 20min fica ~14MB. Acima disso, pulamos silenciosamente
// (fatiar é feature futura, não é P0).
const LIMITE_UPLOAD_BYTES = 24 * 1024 * 1024;

// Se o arquivo de áudio saiu < 1KB, é porque o vídeo não tinha trilha de
// áudio nenhuma (ffmpeg gerou um placeholder vazio).
const MIN_AUDIO_BYTES = 1024;

export interface Transcricao {
  texto: string;
  idioma?: string;
  duracao?: number;
}

/**
 * Extrai áudio do vídeo (FLAC 16kHz mono) e transcreve via Groq Whisper
 * (whisper-large-v3-turbo). Nunca lança pro caller — se algo der errado
 * (Groq offline, arquivo grande demais, sem áudio), volta `null` e o
 * pipeline segue sem transcrição.
 */
export async function transcreverVideo(
  caminhoVideo: string,
  groqApiKey: string,
): Promise<Transcricao | null> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'swell-audio-'));
  const audioPath = path.join(tmpDir, 'audio.flac');

  try {
    // FLAC pra ficar ~1/3 do tamanho de WAV pcm_s16le. Whisper aceita FLAC
    // nativamente. -vn = sem vídeo. -ac 1 mono. -ar 16000 taxa do Whisper.
    try {
      await exec(
        'ffmpeg',
        [
          '-i', caminhoVideo,
          '-vn',
          '-acodec', 'flac',
          '-ar', '16000',
          '-ac', '1',
          '-y',
          audioPath,
        ],
        { timeout: FFMPEG_TIMEOUT_MS },
      );
    } catch (err) {
      // Vídeo sem áudio (ex: kling render), ffmpeg mata com erro.
      console.warn(
        '[transcricao] ffmpeg falhou extraindo áudio — provável vídeo sem trilha:',
        err instanceof Error ? err.message.split('\n')[0] : err,
      );
      return null;
    }

    let tamanho: number;
    try {
      tamanho = (await stat(audioPath)).size;
    } catch {
      return null;
    }

    if (tamanho < MIN_AUDIO_BYTES) {
      // Silêncio total / placeholder.
      return null;
    }
    if (tamanho > LIMITE_UPLOAD_BYTES) {
      const mb = (tamanho / 1024 / 1024).toFixed(1);
      console.warn(
        `[transcricao] áudio de ${mb}MB passa do limite Groq (24MB). ` +
          `Pulando transcrição — vídeo muito longo. (implementar fatiamento futuro).`,
      );
      return null;
    }

    const buffer = await readFile(audioPath);
    const blob = new Blob([new Uint8Array(buffer)], { type: 'audio/flac' });

    const form = new FormData();
    form.append('file', blob, 'audio.flac');
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', 'pt');
    form.append('response_format', 'verbose_json');

    let resposta: Response;
    try {
      resposta = await fetch(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqApiKey}` },
          body: form,
          signal: AbortSignal.timeout(60_000),
        },
      );
    } catch (err) {
      console.warn(
        '[transcricao] Groq fetch falhou:',
        err instanceof Error ? err.message : err,
      );
      return null;
    }

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => '');
      console.warn(
        `[transcricao] Groq HTTP ${resposta.status}: ${corpo.slice(0, 200)}`,
      );
      return null;
    }

    const data = (await resposta.json().catch(() => null)) as {
      text?: string;
      language?: string;
      duration?: number;
    } | null;
    if (!data?.text || !data.text.trim()) {
      return null;
    }

    return {
      texto: data.text.trim(),
      idioma: data.language,
      duracao: data.duration,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
