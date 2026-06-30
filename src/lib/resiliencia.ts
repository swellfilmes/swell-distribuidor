/**
 * Helpers de resiliência pra chamadas externas (Anthropic, Zernio, Notion, ffmpeg).
 * Sem isso, 1 flaky de 5xx mata todo o trabalho do job.
 */

export interface OpcoesRetry {
  /** Quantas tentativas (incluindo a primeira). Default 3. */
  tentativas?: number;
  /** Delay base em ms; cresce exponencialmente (base, base*2, base*4...). Default 500. */
  delayBaseMs?: number;
  /** Timeout por tentativa em ms. Default 30s. 0 desliga. */
  timeoutMs?: number;
  /** Nome usado nos logs/erros (ex: "Anthropic", "Zernio.posts.create"). */
  nome?: string;
  /** Callback opcional pra logar cada falha. */
  onTentativaFalhou?: (info: {
    tentativa: number;
    erro: unknown;
    proximoDelayMs: number;
  }) => void;
  /** Retorna true se o erro é retryable. Default: rede + 5xx + 429. */
  ehRetryable?: (erro: unknown) => boolean;
}

const ERROS_DE_REDE = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'EPIPE',
  'UND_ERR_SOCKET',
]);

function defaultRetryable(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false;
  const e = erro as { code?: string; status?: number; message?: string; cause?: unknown };
  if (e.code && ERROS_DE_REDE.has(e.code)) return true;
  if (typeof e.status === 'number' && (e.status === 429 || e.status >= 500)) return true;
  if (e.message && /timeout|abort/i.test(e.message)) return true;
  if (e.cause) return defaultRetryable(e.cause);
  return false;
}

async function comTimeout<T>(fn: () => Promise<T>, timeoutMs: number, nome: string): Promise<T> {
  if (timeoutMs <= 0) return fn();
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, rej) => {
        ctl.signal.addEventListener('abort', () =>
          rej(new Error(`Timeout ${timeoutMs}ms em ${nome}`)),
        );
      }),
    ]);
  } finally {
    clearTimeout(id);
  }
}

/**
 * Roda `fn` com timeout e retry exponencial. Falhas não-retryable
 * (4xx que não seja 429, erros de validação) propagam de primeira.
 */
export async function comTimeoutERetry<T>(fn: () => Promise<T>, opts: OpcoesRetry = {}): Promise<T> {
  const tentativas = opts.tentativas ?? 3;
  const delayBase = opts.delayBaseMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const nome = opts.nome ?? 'op';
  const ehRetryable = opts.ehRetryable ?? defaultRetryable;

  let ultimoErro: unknown;
  for (let i = 1; i <= tentativas; i++) {
    try {
      return await comTimeout(fn, timeoutMs, nome);
    } catch (err) {
      ultimoErro = err;
      const tentou = i;
      const ultimaTentativa = i === tentativas;
      if (ultimaTentativa || !ehRetryable(err)) {
        throw err;
      }
      const delay = delayBase * Math.pow(2, i - 1) + Math.floor(Math.random() * 250);
      opts.onTentativaFalhou?.({ tentativa: tentou, erro: err, proximoDelayMs: delay });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw ultimoErro;
}
