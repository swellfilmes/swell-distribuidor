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
  zernioApiKey?: string;
  zernioYoutubeAccountId?: string;
  zernioInstagramAccountId?: string;
  zernioTiktokAccountId?: string;
  zernioLinkedinAccountId?: string;
}

/** Helpers pra checar se uma empresa já tem Notion / Zernio prontos. */
export function temNotionConectado(t: TenantConfig): boolean {
  return Boolean(t.notionApiKey && t.notionDbId);
}

/**
 * Zernio considera-se "conectado" quando há API key + pelo menos uma rede com
 * accountId preenchido. Sem accountId nenhum, o publicarTudo vai ignorar todas
 * as redes e o agendamento falha silenciosamente — pior UX que ainda em onboarding.
 */
export function temZernioConectado(t: TenantConfig): boolean {
  const temApiKey = Boolean(t.zernioApiKey);
  const temAlgumaRede = Boolean(
    t.zernioInstagramAccountId ||
      t.zernioYoutubeAccountId ||
      t.zernioTiktokAccountId ||
      t.zernioLinkedinAccountId,
  );
  return temApiKey && temAlgumaRede;
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
