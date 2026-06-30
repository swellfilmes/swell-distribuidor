import { describe, it, expect } from 'vitest';
import { parseCopyField } from '../../src/lib/reconciliarCopy';

describe('parseCopyField', () => {
  it('texto vazio → mapa vazio', () => {
    const m = parseCopyField('');
    expect(m.size).toBe(0);
  });

  it('só whitespace → mapa vazio', () => {
    const m = parseCopyField('   \n\n  \t  ');
    expect(m.size).toBe(0);
  });

  it('1 rede → mapa com 1 entrada', () => {
    const m = parseCopyField('[youtube] caption do yt aqui');
    expect(m.size).toBe(1);
    expect(m.get('youtube')).toBe('caption do yt aqui');
  });

  it('4 redes intercaladas → mapa com 4 entradas, conteúdo correto por rede', () => {
    const texto = [
      '[youtube] yt-body com várias linhas',
      'segunda linha do yt',
      '',
      '[instagram] ig-body curtinho',
      '',
      '[tiktok] tt-body com #hashtag',
      '',
      '[linkedin] li-body institucional',
    ].join('\n');

    const m = parseCopyField(texto);
    expect(m.size).toBe(4);
    expect(m.get('youtube')).toBe('yt-body com várias linhas\nsegunda linha do yt');
    expect(m.get('instagram')).toBe('ig-body curtinho');
    expect(m.get('tiktok')).toBe('tt-body com #hashtag');
    expect(m.get('linkedin')).toBe('li-body institucional');
  });

  it('rede inválida no texto → ignora (não quebra)', () => {
    const texto = '[facebook] não suportado\n\n[youtube] esse vale';
    const m = parseCopyField(texto);
    // Regex só pega as 4 redes válidas; bloco [facebook] vira parte do conteúdo
    // do "nada" (sem cabeçalho válido) — vai ser descartado porque ainda não
    // entramos num bloco válido.
    expect(m.size).toBe(1);
    expect(m.get('youtube')).toBe('esse vale');
  });

  it('case insensitive [YOUTUBE] → vira youtube', () => {
    const m = parseCopyField('[YOUTUBE] CAIXA ALTA');
    expect(m.size).toBe(1);
    expect(m.get('youtube')).toBe('CAIXA ALTA');
  });

  it('cabeçalho sem conteúdo → não entra no mapa', () => {
    const m = parseCopyField('[youtube]   \n  ');
    expect(m.size).toBe(0);
  });
});
