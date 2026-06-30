import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { comTimeoutERetry } from '../../src/lib/resiliencia';

describe('comTimeoutERetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sucesso de 1ª → 1 chamada só, valor retornado', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const p = comTimeoutERetry(fn, { delayBaseMs: 10, timeoutMs: 1000, nome: 't' });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('falha 2x ETIMEDOUT + sucesso na 3ª → 3 chamadas, valor retornado', async () => {
    const erro = Object.assign(new Error('connection timed out'), { code: 'ETIMEDOUT' });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(erro)
      .mockRejectedValueOnce(erro)
      .mockResolvedValueOnce('finalmente');

    const p = comTimeoutERetry(fn, {
      tentativas: 3,
      delayBaseMs: 10,
      timeoutMs: 1000,
      nome: 't',
    });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe('finalmente');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('falha 3x → throw o erro', async () => {
    const erro = Object.assign(new Error('econnreset'), { code: 'ECONNRESET' });
    const fn = vi.fn().mockRejectedValue(erro);

    const p = comTimeoutERetry(fn, {
      tentativas: 3,
      delayBaseMs: 10,
      timeoutMs: 1000,
      nome: 't',
    });
    // Captura o rejeito ANTES de avançar timers pra evitar
    // unhandled rejection no Vitest.
    const caught = p.catch((e) => e);
    await vi.runAllTimersAsync();
    const e = await caught;
    expect(e).toBe(erro);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('erro não-retryable (status 400) → throw na 1ª, não tenta de novo', async () => {
    const erro = Object.assign(new Error('bad request'), { status: 400 });
    const fn = vi.fn().mockRejectedValue(erro);

    const p = comTimeoutERetry(fn, {
      tentativas: 3,
      delayBaseMs: 10,
      timeoutMs: 1000,
      nome: 't',
    });
    const caught = p.catch((e) => e);
    await vi.runAllTimersAsync();
    const e = await caught;
    expect(e).toBe(erro);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('timeoutMs vencido → erro "Timeout"', async () => {
    // fn que nunca resolve; timeout deve disparar.
    const fn = vi.fn(() => new Promise<string>(() => {}));

    const p = comTimeoutERetry(fn, {
      tentativas: 1, // sem retry pra simplificar
      delayBaseMs: 10,
      timeoutMs: 50,
      nome: 'lento',
    });
    const caught = p.catch((e) => e);
    await vi.runAllTimersAsync();
    const e = (await caught) as Error;
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toMatch(/Timeout 50ms em lento/);
  });
});
