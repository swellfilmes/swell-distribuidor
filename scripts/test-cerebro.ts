import { gerarPlano } from '../src/brain/cerebro';
import type { MetaArquivo } from '../src/types';

const metaFake: MetaArquivo = {
  cliente: 'austral',
  tipo: 'aftermovie',
  orientacao: 'h',
  caminhoLocal: './fake/austral_aftermovie_h.mp4',
  nomeArquivo: 'austral_aftermovie_h.mp4',
};

console.log('→ Chamando cérebro com vídeo fictício...');
console.log('  meta:', metaFake);

try {
  const plano = await gerarPlano(metaFake);
  console.log('\n✅ Plano recebido:');
  console.log('  redes       :', plano.redes);
  console.log('  conteudoAI  :', plano.conteudoAI);
  console.log('  resumo      :', plano.resumoInterno);
  console.log('  copy:');
  for (const c of plano.copy) {
    console.log(`    [${c.rede}]`);
    if (c.titulo) console.log(`      título   : ${c.titulo}`);
    console.log(`      descrição: ${c.descricao.slice(0, 120)}${c.descricao.length > 120 ? '...' : ''}`);
    console.log(`      hashtags : ${c.hashtags.join(' ')}`);
  }
  console.log('\n🎉 Cérebro funcionando.');
} catch (err) {
  console.error('\n❌ Erro:', err instanceof Error ? err.message : err);
  process.exit(1);
}
