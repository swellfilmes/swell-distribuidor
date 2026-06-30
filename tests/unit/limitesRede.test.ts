import { describe, it, expect } from 'vitest';
import { filtrarRedesPorTamanho } from '../../src/brain/limitesRede';
import type { Rede } from '../../src/types';

const TODAS: Rede[] = ['youtube', 'instagram', 'tiktok', 'linkedin'];
const MB = 1024 * 1024;
const GB = 1024 * MB;

describe('filtrarRedesPorTamanho', () => {
  it('500MB → tira só tiktok (287MB de limite)', () => {
    const { redes, removidas } = filtrarRedesPorTamanho(TODAS, 500 * MB);
    expect(removidas).toEqual(['tiktok']);
    expect(redes.sort()).toEqual(['instagram', 'linkedin', 'youtube']);
  });

  it('4.5GB → tira tiktok e instagram (instagram cap 4GB)', () => {
    const { redes, removidas } = filtrarRedesPorTamanho(TODAS, 4.5 * GB);
    expect(removidas.sort()).toEqual(['instagram', 'tiktok']);
    expect(redes.sort()).toEqual(['linkedin', 'youtube']);
  });

  it('100MB → não tira nenhuma', () => {
    const { redes, removidas } = filtrarRedesPorTamanho(TODAS, 100 * MB);
    expect(removidas).toEqual([]);
    expect(redes).toEqual(TODAS);
  });

  it('lista vazia → retorna vazio', () => {
    const { redes, removidas } = filtrarRedesPorTamanho([], 100 * MB);
    expect(redes).toEqual([]);
    expect(removidas).toEqual([]);
  });

  it('preserva a ordem original das redes aceitas', () => {
    const { redes } = filtrarRedesPorTamanho(
      ['linkedin', 'tiktok', 'instagram', 'youtube'],
      500 * MB,
    );
    // Apenas tiktok removido; o resto mantém a ordem original.
    expect(redes).toEqual(['linkedin', 'instagram', 'youtube']);
  });
});
