import type { Rede } from '../types';

/**
 * Limites de tamanho de vídeo por rede (em bytes), pra publicação direta.
 * Quando o arquivo passa do limite, a rede é removida do plano
 * automaticamente — sem dar erro lá na hora de publicar via Zernio.
 *
 * Fonte: documentação oficial de cada plataforma (jan 2026). YouTube tem 2
 * limites: 5GB no upload web normal e 256GB pra conta verificada. Mantemos
 * 5GB como teto consensual; pra contas verificadas dá pra publicar maior
 * via Studio direto (sem nosso pipeline).
 */
export const LIMITE_BYTES_POR_REDE: Record<Rede, number> = {
  tiktok: 287 * 1024 * 1024, // 287 MB
  instagram: 4 * 1024 * 1024 * 1024, // 4 GB (Reels)
  linkedin: 5 * 1024 * 1024 * 1024, // 5 GB
  youtube: 256 * 1024 * 1024 * 1024, // 256 GB (cap nosso é 5GB no Uploader)
};

export interface ResultadoFiltro {
  redes: Rede[];
  removidas: Rede[];
}

/**
 * Filtra redes que não aceitam o tamanho do arquivo. Devolve a lista
 * resultante + as redes removidas (pra log/UI).
 */
export function filtrarRedesPorTamanho(
  redes: Rede[],
  tamanhoBytes: number,
): ResultadoFiltro {
  const aceitas: Rede[] = [];
  const removidas: Rede[] = [];
  for (const r of redes) {
    const limite = LIMITE_BYTES_POR_REDE[r];
    if (tamanhoBytes <= limite) {
      aceitas.push(r);
    } else {
      removidas.push(r);
    }
  }
  return { redes: aceitas, removidas };
}
