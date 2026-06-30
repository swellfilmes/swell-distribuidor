export type Orientacao = 'h' | 'v';

/**
 * Tipos de conteúdo. 'foto' e 'carrossel' são imagens; o resto é vídeo.
 * Mantém o nome `TipoVideo` por retrocompat com código antigo — o conceito
 * agora cobre vídeo E imagem (apesar do nome).
 */
export type TipoVideo =
  | 'aftermovie'
  | 'reel'
  | 'bastidor'
  | 'institucional'
  | 'minidoc'
  | 'ai'
  | 'foto'
  | 'carrossel';

/** Categoria de mídia derivada do tipo: imagem vs vídeo. */
export type CategoriaMidia = 'imagem' | 'video';

export function categoriaDoTipo(tipo: TipoVideo): CategoriaMidia {
  return tipo === 'foto' || tipo === 'carrossel' ? 'imagem' : 'video';
}

export type Rede = 'youtube' | 'instagram' | 'tiktok' | 'linkedin';

export interface MetaArquivo {
  cliente: string;
  tipo: TipoVideo;
  orientacao: Orientacao;
  caminhoLocal: string;
  nomeArquivo: string;
}

export interface CopyPorRede {
  rede: Rede;
  titulo?: string;
  descricao: string;
  hashtags: string[];
}

export interface PlanoPublicacao {
  meta: MetaArquivo;
  redes: Rede[];
  copy: CopyPorRede[];
  conteudoAI: boolean;
  resumoInterno: string;
  /** URL pública (R2) da thumbnail escolhida pelo agente de thumbnail. */
  thumbnailUrl?: string;
  /** Última `scheduledFor` (ISO) que mandamos pro Zernio. Comparar com Notion.DataPublicacao pra detectar mudança de data feita pelo humano. */
  dataAgendadaEmZernio?: string;
  /**
   * Carrossel (tipo='carrossel'): URLs das mídias EXTRAS (a 1ª mídia vai em
   * `midia.urlPublica`). Cada uma vira um mediaItem no Zernio na ordem que
   * aparecer aqui. Vazio/undefined pra single image/vídeo.
   */
  mediasExtras?: Array<{ urlPublica: string; chaveR2: string }>;
}

export interface MidiaHospedada {
  urlPublica: string;
  chaveR2: string;
}

export interface ResultadoPublicacao {
  rede: Rede;
  idExterno?: string;
  url?: string;
  status: 'publicado' | 'falhou' | 'pendente' | 'agendado';
  erro?: string;
}
