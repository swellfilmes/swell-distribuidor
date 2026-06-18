import { extrairFrames, extrairFrameHiRes } from '../ingest/extrairFrames';
import { avaliarFramesParaThumbnail } from './thumbnailAgent';
import { subirParaR2 } from '../storage/r2';
import type { TenantConfig } from '../config';
import type { PlanoPublicacao } from '../types';

export interface ThumbnailGerada {
  thumbnailUrl: string;
  timestampSeg: number;
  score: number;
  justificativa: string;
}

/**
 * Pipeline completa de thumbnail pra um vídeo local:
 *  1. extrai 6 frames padrão
 *  2. avalia com Claude vision
 *  3. se nenhum >= 7, extrai 6 deslocados e re-avalia os 12
 *  4. pega o melhor frame em alta res (1280px)
 *  5. sobe no R2
 *  6. devolve URL pública
 */
export async function gerarThumbnailDoVideoLocal(
  tenant: TenantConfig,
  caminhoVideo: string,
  plano: PlanoPublicacao,
  onLog: (msg: string) => void,
): Promise<ThumbnailGerada> {
  onLog(`📸 thumbnail: extraindo 6 frames padrão...`);
  const round1 = await extrairFrames(caminhoVideo, 6);
  onLog(`🧠 thumbnail: avaliando 6 frames...`);
  const av1 = await avaliarFramesParaThumbnail(plano, round1);
  onLog(`   melhor=${av1.melhorIndice} score=${av1.scoreMelhor}/10`);

  let timestampEscolhido = round1[av1.melhorIndice].timestampSeg;
  let scoreFinal = av1.scoreMelhor;
  let justificativaFinal = av1.justificativa;

  if (av1.precisaMaisFrames || av1.scoreMelhor < 7) {
    const tsExistentes = round1.map((f) => f.timestampSeg);
    const passoMedio = tsExistentes.length > 1 ? tsExistentes[1] - tsExistentes[0] : 5;
    const tsNovos = tsExistentes.map((ts) => ts - passoMedio / 2).filter((ts) => ts > 0.5);
    while (tsNovos.length < 6) tsNovos.push(tsExistentes[tsExistentes.length - 1] + passoMedio / 2);

    onLog(`📸 thumbnail: round 2 (nenhum chegou a 7), extraindo 6 novos deslocados...`);
    const round2 = await extrairFrames(caminhoVideo, 6, { timestampsExplicitos: tsNovos });
    const todos = [...round1, ...round2];
    onLog(`🧠 thumbnail: reavaliando 12 frames...`);
    const av2 = await avaliarFramesParaThumbnail(plano, todos);
    onLog(`   melhor=${av2.melhorIndice} score=${av2.scoreMelhor}/10`);
    timestampEscolhido = todos[av2.melhorIndice].timestampSeg;
    scoreFinal = av2.scoreMelhor;
    justificativaFinal = av2.justificativa;
  }

  onLog(`🖼️  thumbnail: extraindo frame hi-res @ ${timestampEscolhido.toFixed(1)}s...`);
  const hiRes = await extrairFrameHiRes(caminhoVideo, timestampEscolhido);
  try {
    onLog(`☁️  thumbnail: subindo no R2...`);
    const midia = await subirParaR2(tenant, hiRes.caminhoArquivo);
    onLog(`   ${midia.urlPublica}`);
    return {
      thumbnailUrl: midia.urlPublica,
      timestampSeg: timestampEscolhido,
      score: scoreFinal,
      justificativa: justificativaFinal,
    };
  } finally {
    await hiRes.limpar();
  }
}
