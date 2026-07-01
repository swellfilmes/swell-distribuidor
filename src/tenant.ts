/**
 * Config carregado por empresa + helpers — SEM dependência de env vars.
 *
 * Esse módulo é safe pra entrar em bundles client-side via cadeia de imports
 * de types/helpers em lib-web/notionData → components/PostsTable. Não importa
 * de `./config` (que valida process.env no top level e quebra no client).
 */

export interface TenantConfig {
  empresaId: number;
  slug: string;
  nome: string;
  // Opcionais: empresas em onboarding podem não ter integrações ainda.
  // notionDo/zernioDo em src/lib/clients lançam erro claro se nulo.
  notionApiKey?: string;
  notionDbId?: string;
  /** Banco Notion separado onde cada cliente desse tenant tem 1 linha
   * (Profile Zernio + accountIds por rede). Só preenchido pra tenants
   * que operam com multi-cliente (Profiles do Zernio). */
  notionClientsDbId?: string;
  zernioApiKey?: string;
  zernioYoutubeAccountId?: string;
  zernioInstagramAccountId?: string;
  zernioTiktokAccountId?: string;
  zernioLinkedinAccountId?: string;
  /** Empresa-testador (criada via convite) usa Profile dentro da conta Zernio
   * da Swell — não tem zernioApiKey própria. Aqui fica o profile_id retornado
   * por zernio.profiles.createProfile no momento do onboarding. */
  zernioProfileId?: string;
  /** Tom de voz personalizado da marca (opcional). Quando vazio, redator e
   * avaliador usam TOM_DE_VOZ_SWELL como fallback. Fica em `empresas` (não em
   * `tenant_secrets`) porque não é segredo — pode aparecer em bundles client
   * se necessário. */
  tomVoz?: string;
}

/** Helpers pra checar se uma empresa já tem Notion / Zernio prontos. */
export function temNotionConectado(t: TenantConfig): boolean {
  return Boolean(t.notionApiKey && t.notionDbId);
}

/**
 * Zernio considera-se "conectado" quando:
 *  - Modo legacy (Swell): API key própria + ≥1 accountId
 *  - Modo Profile (empresa-testador): zernioProfileId setado + ≥1 accountId
 *    (a apiKey é herdada da Swell via zernioDo fallback).
 */
export function temZernioConectado(t: TenantConfig): boolean {
  const temAlgumaRede = Boolean(
    t.zernioInstagramAccountId ||
      t.zernioYoutubeAccountId ||
      t.zernioTiktokAccountId ||
      t.zernioLinkedinAccountId,
  );
  if (!temAlgumaRede) return false;
  return Boolean(t.zernioApiKey) || Boolean(t.zernioProfileId);
}

export function integracoesCompletas(t: TenantConfig): boolean {
  return temNotionConectado(t) && temZernioConectado(t);
}

/**
 * Retorna o notionDbId da empresa ou lança erro claro se ainda não conectou.
 * Usar em todos os lugares que precisam `database_id` direto.
 */
export function notionDbIdDo(t: TenantConfig): string {
  if (!t.notionDbId) {
    throw new Error(
      `Empresa "${t.slug}" ainda não conectou o Notion (sem database_id). ` +
        `Conecte via wizard de onboarding antes de rodar essa operação.`,
    );
  }
  return t.notionDbId;
}
