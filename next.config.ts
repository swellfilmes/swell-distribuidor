import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  experimental: {
    // Permite importar do /src (que usa NodeNext-style imports com .js)
  },
  // /src tem código de servidor que usa Node APIs — não bundlar pra cliente.
  serverExternalPackages: [
    '@notionhq/client',
    '@zernio/node',
    '@aws-sdk/client-s3',
    '@anthropic-ai/sdk',
    '@neondatabase/serverless',
    'drizzle-orm',
  ],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
