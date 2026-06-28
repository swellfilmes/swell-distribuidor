/**
 * Retry com backoff exponencial pra operações Drizzle/Neon que podem dar
 * 429 (Too Many Requests) em rajadas curtas no plano free do Neon.
 *
 * Só retenta se o erro parecer rate-limit; outros erros propagam imediatamente
 * pra não mascarar bugs reais.
 */
export async function comRetryDb<T>(
  fn: () => Promise<T>,
  opts: { tentativas?: number; baseMs?: number } = {},
): Promise<T> {
  const tentativas = opts.tentativas ?? 3;
  const baseMs = opts.baseMs ?? 250;
  let lastErr: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const ehRateLimit = /Too Many Requests|429|rate.?limit|too many connections/i.test(msg);
      if (!ehRateLimit || i === tentativas - 1) throw e;
      // 250ms, 500ms, 1000ms — com jitter pra evitar tempestade sincronizada.
      const espera = baseMs * Math.pow(2, i) + Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, espera));
    }
  }
  throw lastErr;
}
