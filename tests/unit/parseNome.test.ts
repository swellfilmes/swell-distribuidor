import { describe, it, expect } from 'vitest';
import { parseNome } from '../../src/ingest/parseNome';

describe('parseNome', () => {
  it('austral_aftermovie_h.mp4 → cliente=austral, tipo=aftermovie, orientacao=h', () => {
    const meta = parseNome('austral_aftermovie_h.mp4');
    expect(meta.cliente).toBe('austral');
    expect(meta.tipo).toBe('aftermovie');
    expect(meta.orientacao).toBe('h');
    expect(meta.nomeArquivo).toBe('austral_aftermovie_h.mp4');
  });

  it('metroval_reel_v.mp4 → cliente=metroval, tipo=reel, orientacao=v', () => {
    const meta = parseNome('metroval_reel_v.mp4');
    expect(meta.cliente).toBe('metroval');
    expect(meta.tipo).toBe('reel');
    expect(meta.orientacao).toBe('v');
  });

  it('becogelato_ai_v.mp4 → cliente=becogelato, tipo=ai, orientacao=v', () => {
    const meta = parseNome('becogelato_ai_v.mp4');
    expect(meta.cliente).toBe('becogelato');
    expect(meta.tipo).toBe('ai');
    expect(meta.orientacao).toBe('v');
  });

  it('extensão upper .MP4 → aceita (parseNome só usa o basename)', () => {
    const meta = parseNome('austral_aftermovie_h.MP4');
    expect(meta.cliente).toBe('austral');
    expect(meta.tipo).toBe('aftermovie');
    expect(meta.orientacao).toBe('h');
  });

  it('case-insensitive nas partes (AUSTRAL_REEL_V.mp4) → tudo minúsculo', () => {
    const meta = parseNome('AUSTRAL_REEL_V.mp4');
    expect(meta.cliente).toBe('austral');
    expect(meta.tipo).toBe('reel');
    expect(meta.orientacao).toBe('v');
  });

  it('caminho com diretório → pega só o basename', () => {
    const meta = parseNome('/Users/foo/_PUBLICAR/metroval_reel_v.mp4');
    expect(meta.cliente).toBe('metroval');
    expect(meta.nomeArquivo).toBe('metroval_reel_v.mp4');
  });

  it('nome inválido (poucas partes) → throw', () => {
    expect(() => parseNome('austral.mp4')).toThrow(/fora do padrão/i);
  });

  it('tipo desconhecido → throw', () => {
    expect(() => parseNome('austral_xpto_h.mp4')).toThrow(/Tipo "xpto"/);
  });

  it('orientação inválida → throw', () => {
    expect(() => parseNome('austral_reel_x.mp4')).toThrow(/Orientação "x"/);
  });
});
