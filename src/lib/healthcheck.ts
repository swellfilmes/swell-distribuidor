/**
 * Healthchecks.io ping. Configure 1 check por cron no painel e cole
 * a URL "ping" em HEALTHCHECKS_<NOME>_URL no .env.
 *
 * Sem URL configurada, vira no-op silencioso — não quebra o cron.
 */

type Status = 'start' | 'success' | 'fail';

export async function pingHealthcheck(url: string | undefined, status: Status = 'success'): Promise<void> {
  if (!url) return;
  const sufixo = status === 'start' ? '/start' : status === 'fail' ? '/fail' : '';
  const alvo = `${url.replace(/\/$/, '')}${sufixo}`;
  try {
    await fetch(alvo, {
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Não derruba o cron por causa de um ping
  }
}

/**
 * Wrapper que pinga start, executa, pinga success/fail.
 */
export async function comHealthcheck<T>(
  url: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  await pingHealthcheck(url, 'start');
  try {
    const r = await fn();
    await pingHealthcheck(url, 'success');
    return r;
  } catch (err) {
    await pingHealthcheck(url, 'fail');
    throw err;
  }
}
