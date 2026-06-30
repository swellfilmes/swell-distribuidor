import type { TenantConfig } from '../tenant';
import type { Rede } from '../types';
import { buscarClientePorSlug } from './notionClientes';

/**
 * Resolve os accountIds dinâmicos pra um post baseado no slug do cliente
 * (`meta.cliente` do parseNome ou flag CLI --cliente). Devolve `undefined`
 * se o tenant não tem banco de clientes configurado OU se o cliente não
 * existe no banco — nesse caso, `publicarTudo` cai no fallback do perfil
 * default do tenant (env legacy).
 *
 * Decisão: lookup acontece NO MOMENTO DE PUBLICAR (não no ingest) pra
 * sempre pegar accountIds atuais — se uma rede do cliente reconectou,
 * o accountId mudou.
 */
export async function resolverAccountIdsDoCliente(
  tenant: TenantConfig,
  clienteSlug: string,
  onLog?: (msg: string) => void,
): Promise<Partial<Record<Rede, string>> | undefined> {
  if (!tenant.notionClientsDbId) {
    onLog?.(`tenant "${tenant.slug}" sem notionClientsDbId, usando perfil default.`);
    return undefined;
  }
  if (!clienteSlug || clienteSlug === tenant.slug) {
    // Conteúdo do próprio tenant (ex: Swell rodando algo institucional dela
    // própria) — usa perfil default sem lookup.
    return undefined;
  }
  try {
    const cliente = await buscarClientePorSlug(tenant, clienteSlug);
    if (!cliente) {
      onLog?.(`cliente "${clienteSlug}" não está no Notion clients DB — usando perfil default.`);
      return undefined;
    }
    const overrides: Partial<Record<Rede, string>> = {};
    for (const r of ['instagram', 'youtube', 'tiktok', 'linkedin'] as Rede[]) {
      const id = cliente.accountIds[r];
      // Importante: também preserva string vazia (rede desconectada). Permite
      // o cliente "desligar" uma rede sem deletar a linha — publicarTudo
      // detecta vazio e marca como redeIgnorada.
      if (id !== undefined) overrides[r] = id;
    }
    onLog?.(
      `cliente "${clienteSlug}" achado (profileId=${cliente.zernioProfileId}, status=${cliente.status}) — accountIds: ${
        Object.entries(overrides)
          .map(([r, id]) => `${r}=${id || '(vazio)'}`)
          .join(', ') || '(nenhum)'
      }`,
    );
    return overrides;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onLog?.(`lookup do cliente "${clienteSlug}" falhou: ${msg} — usando perfil default.`);
    return undefined;
  }
}
