/**
 * Init Sentry pro worker Railway. Carrega só se SENTRY_DSN existir.
 * Import dynamic pra não pesar o boot quando rodando sem observability.
 */
import * as Sentry from '@sentry/nextjs';

let inicializado = false;

export function initSentryWorker(): void {
  if (inicializado) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_APP_VERSION,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
  inicializado = true;
}

export function captureException(err: unknown, ctx?: Record<string, unknown>): void {
  if (!inicializado) return;
  Sentry.captureException(err, ctx ? { extra: ctx } : undefined);
}
