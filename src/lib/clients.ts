import { Client as NotionClient } from '@notionhq/client';
import { Zernio } from '@zernio/node';
import type { TenantConfig } from '../config';

const notionCache = new WeakMap<TenantConfig, NotionClient>();
const zernioCache = new WeakMap<TenantConfig, Zernio>();

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

/** Cliente Zernio da empresa (memoizado por objeto TenantConfig). */
export function zernioDo(tenant: TenantConfig): Zernio {
  if (!tenant.zernioApiKey) {
    throw new Error(
      `Empresa "${tenant.slug}" ainda não conectou o Zernio. ` +
        `Cole a API key no wizard de onboarding ou no admin.`,
    );
  }
  let c = zernioCache.get(tenant);
  if (!c) {
    c = new Zernio({ apiKey: tenant.zernioApiKey });
    zernioCache.set(tenant, c);
  }
  return c;
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
