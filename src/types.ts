export type Orientacao = 'h' | 'v';

export type TipoVideo =
  | 'aftermovie'
  | 'reel'
  | 'bastidor'
  | 'institucional'
  | 'minidoc'
  | 'ai';

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
