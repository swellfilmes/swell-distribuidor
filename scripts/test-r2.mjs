import 'dotenv/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Buffer } from 'node:buffer';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL,
} = process.env;

console.log('Config R2:');
console.log('  accountId  :', R2_ACCOUNT_ID);
console.log('  bucket     :', R2_BUCKET);
console.log('  publicBase :', R2_PUBLIC_BASE_URL);

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const key = `teste/hello-${Date.now()}.txt`;
const body = Buffer.from(`Olá da Swell! Teste de upload em ${new Date().toISOString()}`);

console.log(`\n→ Enviando arquivo de teste: ${key}`);

try {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: 'text/plain; charset=utf-8',
    }),
  );
  console.log('✅ Upload OK.');

  const publicUrl = `${R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  console.log(`\n→ Tentando ler publicamente: ${publicUrl}`);

  const resp = await fetch(publicUrl);
  if (!resp.ok) {
    console.log(`❌ Não conseguiu ler publicamente (status ${resp.status}).`);
    console.log('   Provavelmente o "Public Access" do bucket não está ativado.');
    process.exit(2);
  }
  const txt = await resp.text();
  console.log('✅ URL pública funcionando.');
  console.log(`   Conteúdo recebido: "${txt}"`);
  console.log('\nTudo certo no R2! 🎉');
} catch (err) {
  console.error('❌ Erro:', err.message);
  if (err.$metadata) console.error('   HTTP:', err.$metadata.httpStatusCode);
  process.exit(1);
}
