import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Healthcheck simples pro Railway/Vercel. Não verifica dependências (DB, R2)
 * de propósito — se o DB cair, a app inteira fica indisponível e a gente
 * quer que o load balancer continue mandando tráfego pro container que
 * está vivo, não cycle-restart por causa de um Neon transient.
 */
export function GET(): Response {
  return NextResponse.json({
    ok: true,
    service: 'swell-mermaid-web',
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
    timestamp: new Date().toISOString(),
  });
}
