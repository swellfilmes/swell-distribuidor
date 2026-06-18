import type { NextConfig } from 'next';

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
};

export default nextConfig;
