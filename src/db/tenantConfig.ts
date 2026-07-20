import { eq } from 'drizzle-orm';
import { db } from './index';
import { empresas, tenantSecrets } from './schema';
import { decifrar } from './encryption';
import { comRetryDb } from './retry';
import type { TenantConfig } from '../config';

// TTL curto porque em Vercel serverless o cache é per-instance: quando o OAuth
// grava novas chaves numa instância, as outras continuam servindo cache velho
// até o TTL expirar. 30s é curto o bastante pra onboarding não travar em
// "Notion não conectado" e longo pra amortizar leituras dentro de uma sessão.
const CACHE_TTL_MS = 30_000;
interface CacheEntry {
  cfg: TenantConfig;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

/** Carrega config de uma empresa pelo slug (ex: 'swell'). Faz cache em memória com TTL de 30s. */
export async function loadTenantConfig(slug: string): Promise<TenantConfig> {
  const hit = cache.get(slug);
  if (hit && hit.expiresAt > Date.now()) return hit.cfg;

  const linhas = await comRetryDb(() =>
    db
      .select()
      .from(empresas)
      .innerJoin(tenantSecrets, eq(empresas.id, tenantSecrets.empresaId))
      .where(eq(empresas.slug, slug))
      .limit(1),
  );

  if (linhas.length === 0) {
    throw new Error(
      `Empresa com slug "${slug}" não encontrada no banco. ` +
        `Rode "npm run distribuir -- --listar-empresas" pra ver as disponíveis ` +
        `ou "tsx scripts/migrate-swell-tenant.ts" pra criar o tenant Swell a partir do .env.`,
    );
  }

  const { empresas: e, tenant_secrets: s } = linhas[0];

  const cfg: TenantConfig = {
    empresaId: e.id,
    slug: e.slug,
    nome: e.nome,
    notionApiKey: s.notionApiKeyEncrypted ? decifrar(s.notionApiKeyEncrypted) : undefined,
    notionDbId: s.notionDbId ?? undefined,
    notionClientsDbId: s.notionClientsDbId ?? process.env.NOTION_CLIENTS_DB_ID ?? undefined,
    zernioApiKey: s.zernioApiKeyEncrypted ? decifrar(s.zernioApiKeyEncrypted) : undefined,
    zernioYoutubeAccountId: s.zernioYoutubeAccountId ?? undefined,
    zernioInstagramAccountId: s.zernioInstagramAccountId ?? undefined,
    zernioTiktokAccountId: s.zernioTiktokAccountId ?? undefined,
    zernioLinkedinAccountId: s.zernioLinkedinAccountId ?? undefined,
    zernioProfileId: s.zernioProfileId ?? undefined,
    tomVoz: e.tomVoz ?? undefined,
  };

  cache.set(slug, { cfg, expiresAt: Date.now() + CACHE_TTL_MS });
  return cfg;
}

/** Carrega config de uma empresa pelo id numérico (worker/crons). */
export async function loadTenantConfigById(empresaId: number): Promise<TenantConfig> {
  const linhas = await db
    .select()
    .from(empresas)
    .innerJoin(tenantSecrets, eq(empresas.id, tenantSecrets.empresaId))
    .where(eq(empresas.id, empresaId))
    .limit(1);
  if (linhas.length === 0) {
    throw new Error(`Empresa id=${empresaId} não encontrada.`);
  }
  const { empresas: e, tenant_secrets: s } = linhas[0];
  return {
    empresaId: e.id,
    slug: e.slug,
    nome: e.nome,
    notionApiKey: s.notionApiKeyEncrypted ? decifrar(s.notionApiKeyEncrypted) : undefined,
    notionDbId: s.notionDbId ?? undefined,
    notionClientsDbId: s.notionClientsDbId ?? process.env.NOTION_CLIENTS_DB_ID ?? undefined,
    zernioApiKey: s.zernioApiKeyEncrypted ? decifrar(s.zernioApiKeyEncrypted) : undefined,
    zernioYoutubeAccountId: s.zernioYoutubeAccountId ?? undefined,
    zernioInstagramAccountId: s.zernioInstagramAccountId ?? undefined,
    zernioTiktokAccountId: s.zernioTiktokAccountId ?? undefined,
    zernioLinkedinAccountId: s.zernioLinkedinAccountId ?? undefined,
    zernioProfileId: s.zernioProfileId ?? undefined,
    tomVoz: e.tomVoz ?? undefined,
  };
}

/** Lista todas as empresas ativas (pra crons multi-tenant). */
export async function listarEmpresasAtivas(): Promise<
  Array<{ id: number; slug: string; nome: string }>
> {
  const linhas = await db
    .select({ id: empresas.id, slug: empresas.slug, nome: empresas.nome })
    .from(empresas)
    .where(eq(empresas.ativo, true));
  return linhas;
}

/** Limpa cache (usar quando admin atualiza chaves de uma empresa). */
export function invalidarCache(slug?: string): void {
  if (slug) cache.delete(slug);
  else cache.clear();
}
