import { Client as NotionClient } from '@notionhq/client';
import { Zernio } from '@zernio/node';
import type { TenantConfig } from '../config';

const notionCache = new WeakMap<TenantConfig, NotionClient>();
const zernioCache = new WeakMap<TenantConfig, Zernio>();

/** Tenant default que segura a conta Zernio compartilhada (Swell). Empresas
 * criadas via convite herdam essa conta + têm 1 Profile dentro dela. */
const TENANT_DEFAULT_SLUG = 'swell';
let zernioCompartilhadoCache: Zernio | null = null;

/** Cliente Notion da empresa (memoizado por objeto TenantConfig). */
export function notionDo(tenant: TenantConfig): NotionClient {
  if (!tenant.notionApiKey) {
    throw new Error(
      `Empresa "${tenant.slug}" ainda não conectou o Notion. ` +
        `Use o wizard de onboarding ou o botão "Conectar Notion (OAuth)" no admin.`,
    );
  }
  let c = notionCache.get(tenant);
  if (!c) {
    c = new NotionClient({ auth: tenant.notionApiKey });
    notionCache.set(tenant, c);
  }
  return c;
}

/** Cliente Zernio da empresa (memoizado por objeto TenantConfig).
 *
 * Fallback: empresa-testador (sem zernioApiKey própria, com zernioProfileId)
 * usa a conta Zernio da Swell. Pegamos a apiKey via loadTenantConfig do
 * tenant default em runtime — import circular-safe via require dinâmico. */
export function zernioDo(tenant: TenantConfig): Zernio {
  if (tenant.zernioApiKey) {
    let c = zernioCache.get(tenant);
    if (!c) {
      c = new Zernio({ apiKey: tenant.zernioApiKey });
      zernioCache.set(tenant, c);
    }
    return c;
  }
  // Empresa-testador: usa Zernio compartilhado.
  if (tenant.zernioProfileId) {
    if (!zernioCompartilhadoCache) {
      // Síncrono é problemático — quem chama zernioDo precisa ter feito o
      // setup primeiro via inicializarZernioCompartilhado(swellTenant).
      throw new Error(
        `zernioCompartilhado não inicializado. Chame inicializarZernioCompartilhado(swellTenant) ` +
          `no boot do worker / CLI / API antes de publicar via empresa-testador "${tenant.slug}".`,
      );
    }
    return zernioCompartilhadoCache;
  }
  throw new Error(
    `Empresa "${tenant.slug}" ainda não conectou o Zernio. ` +
      `Cole a API key no wizard de onboarding ou conecte um Profile via convite.`,
  );
}

/** Inicializa o cliente Zernio compartilhado (Swell) usado por empresas-
 * testador que só têm zernioProfileId. Idempotente. */
export function inicializarZernioCompartilhado(tenantDefault: TenantConfig): void {
  if (zernioCompartilhadoCache) return;
  if (tenantDefault.slug !== TENANT_DEFAULT_SLUG) {
    throw new Error(`Inicializei com tenant "${tenantDefault.slug}", esperava "${TENANT_DEFAULT_SLUG}".`);
  }
  if (!tenantDefault.zernioApiKey) {
    throw new Error(`Tenant default "${TENANT_DEFAULT_SLUG}" sem zernioApiKey — não dá pra compartilhar.`);
  }
  zernioCompartilhadoCache = new Zernio({ apiKey: tenantDefault.zernioApiKey });
}

/** Garante que o Zernio compartilhado está pronto antes de qualquer operação
 * que possa precisar dele (publish, listAccounts via Profile, etc). Lazy
 * load do tenant default. Idempotente — múltiplas chamadas concorrentes OK. */
export async function garantirZernioInicializado(): Promise<void> {
  if (zernioCompartilhadoCache) return;
  // Import dinâmico evita ciclo: tenantConfig importa de clients pra notionDo? Não.
  // tenantConfig só importa schema/encryption. Safe.
  const { loadTenantConfig } = await import('../db/tenantConfig');
  const swell = await loadTenantConfig(TENANT_DEFAULT_SLUG);
  inicializarZernioCompartilhado(swell);
}

/** Retorna o tenantSlug efetivo que dona a apiKey Zernio que será usada pelo
 * cliente — útil pra construir URLs do dashboard / debug. */
export function donoZernioApiKey(tenant: TenantConfig): string {
  return tenant.zernioApiKey ? tenant.slug : TENANT_DEFAULT_SLUG;
}

/** Resolve o accountId da rede a partir do tenant. */
export function contaConfiguradaPara(
  tenant: TenantConfig,
  rede: 'youtube' | 'instagram' | 'tiktok' | 'linkedin',
): string | undefined {
  switch (rede) {
    case 'youtube':
      return tenant.zernioYoutubeAccountId;
    case 'instagram':
      return tenant.zernioInstagramAccountId;
    case 'tiktok':
      return tenant.zernioTiktokAccountId;
    case 'linkedin':
      return tenant.zernioLinkedinAccountId;
  }
}
