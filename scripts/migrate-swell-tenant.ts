/**
 * Script de bootstrap: cria/atualiza o tenant "swell" no banco a partir das
 * variáveis do .env LEGADAS (NOTION_API_KEY, NOTION_DB_ID, ZERNIO_*).
 *
 * Rode UMA vez depois de fazer o `drizzle-kit push` da primeira vez. Depois
 * disso o .env não precisa mais ter NOTION_* nem ZERNIO_* — fica só com as
 * vars globais.
 *
 * Uso:  npx tsx scripts/migrate-swell-tenant.ts
 */
import 'dotenv/config';
import { db } from '../src/db/index';
import { empresas, tenantSecrets } from '../src/db/schema';
import { cifrar } from '../src/db/encryption';
import { eq } from 'drizzle-orm';

function exigirEnv(nome: string): string {
  const v = process.env[nome];
  if (!v) {
    console.error(`❌ ${nome} ausente no .env — não consigo migrar.`);
    process.exit(1);
  }
  return v;
}

function opcEnv(nome: string): string | undefined {
  const v = process.env[nome];
  return v && v.length > 0 ? v : undefined;
}

async function main() {
  const notionApiKey = exigirEnv('NOTION_API_KEY');
  const notionDbId = exigirEnv('NOTION_DB_ID');
  const zernioApiKey = exigirEnv('ZERNIO_API_KEY');

  const zernioYoutube = opcEnv('ZERNIO_YOUTUBE_ACCOUNT_ID');
  const zernioInstagram = opcEnv('ZERNIO_INSTAGRAM_ACCOUNT_ID');
  const zernioTiktok = opcEnv('ZERNIO_TIKTOK_ACCOUNT_ID');
  const zernioLinkedin = opcEnv('ZERNIO_LINKEDIN_ACCOUNT_ID');

  console.log('Verificando se empresa "swell" já existe...');
  const existente = await db
    .select()
    .from(empresas)
    .where(eq(empresas.slug, 'swell'))
    .limit(1);

  let empresaId: number;

  if (existente.length === 0) {
    console.log('Criando empresa "swell"...');
    const inserida = await db
      .insert(empresas)
      .values({ slug: 'swell', nome: 'Swell Filmes', ativo: true })
      .returning({ id: empresas.id });
    empresaId = inserida[0].id;
    console.log(`  ✅ empresa criada com id=${empresaId}.`);
  } else {
    empresaId = existente[0].id;
    console.log(`  ℹ️  empresa já existe (id=${empresaId}). Atualizando segredos.`);
  }

  console.log('Cifrando chaves...');
  const notionEnc = cifrar(notionApiKey);
  const zernioEnc = cifrar(zernioApiKey);

  console.log('Gravando tenant_secrets...');
  await db
    .insert(tenantSecrets)
    .values({
      empresaId,
      notionApiKeyEncrypted: notionEnc,
      notionDbId,
      zernioApiKeyEncrypted: zernioEnc,
      zernioYoutubeAccountId: zernioYoutube ?? null,
      zernioInstagramAccountId: zernioInstagram ?? null,
      zernioTiktokAccountId: zernioTiktok ?? null,
      zernioLinkedinAccountId: zernioLinkedin ?? null,
    })
    .onConflictDoUpdate({
      target: tenantSecrets.empresaId,
      set: {
        notionApiKeyEncrypted: notionEnc,
        notionDbId,
        zernioApiKeyEncrypted: zernioEnc,
        zernioYoutubeAccountId: zernioYoutube ?? null,
        zernioInstagramAccountId: zernioInstagram ?? null,
        zernioTiktokAccountId: zernioTiktok ?? null,
        zernioLinkedinAccountId: zernioLinkedin ?? null,
        atualizadoEm: new Date(),
      },
    });

  console.log(`\n✅ Tenant "swell" pronto. Teste com:`);
  console.log(`   npm run distribuir -- --listar-empresas`);
  console.log(`   npm run distribuir -- --empresa swell --listar-contas`);
}

main().catch((err) => {
  console.error('\n💥 Erro na migração:');
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
