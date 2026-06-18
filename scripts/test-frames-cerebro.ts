import { extrairFrames } from '../src/ingest/extrairFrames';
import { gerarPlano } from '../src/brain/cerebro';
import type { MetaArquivo } from '../src/types';

const caminho =
  '/Users/joaocosta/Downloads/AFTERMOVIE_ACT_PREMIER_2025_V03_prob3 (1).mp4';

const meta: MetaArquivo = {
  cliente: 'act',
  tipo: 'aftermovie',
  orientacao: 'h',
  caminhoLocal: caminho,
  nomeArquivo: 'act_aftermovie_h.mp4',
};

console.log('→ Extraindo 6 frames...');
const t0 = Date.now();
const frames = await extrairFrames(caminho, 6);
const tamKB = frames.reduce((s, f) => s + f.base64.length * 0.75, 0) / 1024;
console.log(
  `  ✅ ${frames.length} frames em ${((Date.now() - t0) / 1000).toFixed(1)}s (~${tamKB.toFixed(0)} KB)`,
);
console.log('  Timestamps:', frames.map((f) => f.timestampSeg.toFixed(1) + 's').join(', '));

console.log('\n→ Chamando cérebro (Sonnet 4.6) com frames + meta...');
const t1 = Date.now();
const plano = await gerarPlano(meta, frames);
console.log(`  ✅ resposta em ${((Date.now() - t1) / 1000).toFixed(1)}s\n`);

console.log('═══════════════════════════════════════');
console.log('RESUMO:', plano.resumoInterno);
console.log('REDES :', plano.redes.join(', '));
console.log('AI    :', plano.conteudoAI);
console.log('═══════════════════════════════════════');

for (const c of plano.copy) {
  console.log(`\n── ${c.rede.toUpperCase()} ──`);
  if (c.titulo) console.log(`Título: ${c.titulo}`);
  console.log(`\n${c.descricao}`);
  if (c.hashtags.length) console.log(`\nHashtags: ${c.hashtags.join(' ')}`);
}
