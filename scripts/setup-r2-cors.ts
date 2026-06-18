/**
 * Configura CORS no bucket R2 pra aceitar PUT direto do browser.
 *
 * Roda 1 vez. Sem isso, o upload do browser bate em "CORS error".
 *
 * Uso:  npm run r2:setup-cors
 */
import 'dotenv/config';
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error('❌ Faltam env vars R2_*. Confere o .env.');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

const origens = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4488',
  'http://localhost:8080',
  // adicione aqui o domínio do Vercel quando deploy: https://swell-distribuidor.vercel.app
];

async function main() {
  console.log(`Configurando CORS no bucket "${bucket}"...`);
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedMethods: ['PUT', 'GET', 'HEAD'],
            AllowedOrigins: origens,
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log('✅ CORS configurado pra:');
  for (const o of origens) console.log(`   - ${o}`);
  console.log('\nQuando você fizer deploy na Vercel, edite o array `origens` ');
  console.log('em scripts/setup-r2-cors.ts e rode de novo pra incluir a URL .vercel.app.');
}

main().catch((err) => {
  console.error('\n💥 Falhou:');
  console.error(err);
  process.exit(1);
});
