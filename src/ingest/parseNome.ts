import path from 'node:path';
import type { MetaArquivo, Orientacao, TipoVideo } from '../types';

const TIPOS_VALIDOS: readonly TipoVideo[] = [
  'aftermovie',
  'reel',
  'bastidor',
  'institucional',
  'minidoc',
  'ai',
  'foto',
  'carrossel',
];

/** Extensões de imagem aceitas (pra Fatia 2.D.1+). */
const EXTENSOES_IMAGEM = new Set(['.jpg', '.jpeg', '.png', '.webp']);
/** Extensões de vídeo aceitas. */
const EXTENSOES_VIDEO = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);

export function ehImagem(caminhoLocal: string): boolean {
  const ext = caminhoLocal.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  return EXTENSOES_IMAGEM.has(ext);
}

export function ehVideo(caminhoLocal: string): boolean {
  const ext = caminhoLocal.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  return EXTENSOES_VIDEO.has(ext);
}

export function mimeTypeDoArquivo(caminhoLocal: string): string {
  const ext = caminhoLocal.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.webm':
      return 'video/webm';
    case '.mkv':
      return 'video/x-matroska';
    case '.m4v':
      return 'video/x-m4v';
    default:
      return 'application/octet-stream';
  }
}

const ORIENTACOES_VALIDAS: readonly Orientacao[] = ['h', 'v'];

export function parseNome(caminhoLocal: string): MetaArquivo {
  const nomeArquivo = path.basename(caminhoLocal);
  const semExt = nomeArquivo.replace(/\.[^.]+$/, '');
  const partes = semExt.split('_');

  if (partes.length < 3) {
    throw new Error(
      `Nome do arquivo fora do padrão: "${nomeArquivo}". ` +
        `Esperado: [cliente]_[tipo]_[orientacao].mp4 ` +
        `(ex: austral_aftermovie_h.mp4)`,
    );
  }

  const [cliente, tipoBruto, orientacaoBruta] = [
    partes[0].toLowerCase(),
    partes[1].toLowerCase(),
    partes[2].toLowerCase(),
  ];

  if (!TIPOS_VALIDOS.includes(tipoBruto as TipoVideo)) {
    throw new Error(
      `Tipo "${tipoBruto}" não reconhecido em "${nomeArquivo}". ` +
        `Tipos válidos: ${TIPOS_VALIDOS.join(', ')}.`,
    );
  }

  if (!ORIENTACOES_VALIDAS.includes(orientacaoBruta as Orientacao)) {
    throw new Error(
      `Orientação "${orientacaoBruta}" inválida em "${nomeArquivo}". ` +
        `Use "h" (horizontal/16:9) ou "v" (vertical/9:16).`,
    );
  }

  return {
    cliente,
    tipo: tipoBruto as TipoVideo,
    orientacao: orientacaoBruta as Orientacao,
    caminhoLocal,
    nomeArquivo,
  };
}
