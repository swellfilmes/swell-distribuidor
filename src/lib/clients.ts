import { Client as NotionClient } from '@notionhq/client';
import { Zernio } from '@zernio/node';
import type { TenantConfig } from '../config';

const notionCache = new WeakMap<TenantConfig, NotionClient>();
const zernioCache = new WeakMap<TenantConfig, Zernio>();

/** Cliente Notion da empresa (memoizado por objeto TenantConfig). */
export function notionDo(tenant: TenantConfig): NotionClient {
  let c = notionCache.get(tenant);
  if (!c) {
    c = new NotionClient({ auth: tenant.notionApiKey });
    notionCache.set(tenant, c);
  }
  return c;
}

/** Cliente Zernio da empresa (memoizado por objeto TenantConfig). */
export function zernioDo(tenant: TenantConfig): Zernio {
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
