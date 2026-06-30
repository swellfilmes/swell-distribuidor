import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FrameExtraido } from './extrairFrames';
import type { Orientacao } from '../types';

const exec = promisify(execFile);

function mediaTypeDaExtensao(
  caminho: string,
): 'image/jpeg' | 'image/png' | 'image/webp' {
  const ext = caminho.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg'; // .jpg, .jpeg, fallback
}

/**
 * Lê uma imagem do disco e devolve no mesmo formato que extrairFrames usa,
 * pra ser passada ao cérebro Claude sem branching no consumer. Uma imagem
 * vira UM frame único.
 */
export async function lerImagemComoFrame(
  caminhoImagem: string,
): Promise<FrameExtraido> {
  const buf = await readFile(caminhoImagem);
  return {
    timestampSeg: 0,
    base64: buf.toString('base64'),
    mediaType: mediaTypeDaExtensao(caminhoImagem),
  };
}

/**
 * Detecta orientação de uma imagem via ffprobe (já tá disponível no sistema).
 * h se largura >= altura, v caso contrário.
 */
export async function detectarOrientacaoImagem(
  caminhoImagem: string,
): Promise<Orientacao> {
  const { stdout } = await exec('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0',
    caminhoImagem,
  ]);
  const [wStr, hStr] = stdout.trim().split(',');
  const w = parseInt(wStr, 10);
  const h = parseInt(hStr, 10);
  return w >= h ? 'h' : 'v';
}
