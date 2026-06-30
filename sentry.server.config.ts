import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_APP_VERSION,
    tracesSampleRate: 0.1,
    // Não captura PII de jeito nenhum. Dados de cliente são sensíveis.
    sendDefaultPii: false,
  });
}
