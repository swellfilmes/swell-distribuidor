import { describe, it, expect } from 'vitest';
import { ehAgendamentoFuturo } from '../../src/publish/agendamento';

describe('ehAgendamentoFuturo', () => {
  const agora = new Date('2026-06-30T12:00:00.000Z');

  it('data 1h no futuro → true', () => {
    const futuro = new Date(agora.getTime() + 60 * 60 * 1000).toISOString();
    expect(ehAgendamentoFuturo(futuro, agora)).toBe(true);
  });

  it('data 1h no passado → false', () => {
    const passado = new Date(agora.getTime() - 60 * 60 * 1000).toISOString();
    expect(ehAgendamentoFuturo(passado, agora)).toBe(false);
  });

  it('data vazia → false', () => {
    expect(ehAgendamentoFuturo('', agora)).toBe(false);
  });

  it('null/undefined → false', () => {
    expect(ehAgendamentoFuturo(null, agora)).toBe(false);
    expect(ehAgendamentoFuturo(undefined, agora)).toBe(false);
  });

  it('"agora" exato → false (limite seguro: empate publica agora)', () => {
    expect(ehAgendamentoFuturo(agora.toISOString(), agora)).toBe(false);
  });

  it('data inválida (string lixo) → false', () => {
    expect(ehAgendamentoFuturo('not-a-date', agora)).toBe(false);
  });

  it('default `agora` = new Date() → datas passadas continuam false', () => {
    // Sem segundo argumento, deve cair no Date.now real.
    expect(ehAgendamentoFuturo('2020-01-01T00:00:00.000Z')).toBe(false);
  });
});
