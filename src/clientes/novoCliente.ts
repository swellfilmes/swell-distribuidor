import { zernioDo } from '../lib/clients';
import type { TenantConfig } from '../tenant';
import type { Rede } from '../types';
import { buscarClientePorSlug, criarLinhaCliente } from './notionClientes';

const PLATAFORMAS_VALIDAS: ReadonlyArray<Rede> = ['instagram', 'youtube', 'tiktok', 'linkedin'];

/**
 * Mapeia nossa enum interna de Rede pra exatamente o que o Zernio aceita em
 * connect.getConnectUrl. SDK hoje aceita os mesmos nomes (lowercase), mas
 * deixamos explícito pra não quebrar se mudarmos a enum interna depois.
 */
const PLATAFORMA_ZERNIO: Record<Rede, 'instagram' | 'youtube' | 'tiktok' | 'linkedin'> = {
  instagram: 'instagram',
  youtube: 'youtube',
  tiktok: 'tiktok',
  linkedin: 'linkedin',
};

export interface NovoClienteOpts {
  /** Nome de display do cliente (default = clientId capitalizado). */
  nome?: string;
  /** Redes a conectar (1+). Sem isso, manda erro. */
  redes: Rede[];
  /** Redirect URL que o cliente vai cair após autorizar no Zernio (opcional). */
  redirectUrl?: string;
}

export interface NovoClienteResultado {
  clientId: string;
  zernioProfileId: string;
  notionPageUrl: string;
  links: Array<{ rede: Rede; authUrl: string }>;
}

export async function executarNovoCliente(
  tenant: TenantConfig,
  clientId: string,
  opts: NovoClienteOpts,
  onLog: (msg: string) => void = (m) => console.log(m),
): Promise<NovoClienteResultado> {
  // Validações up-front pra dar erro claro antes de mexer no Zernio/Notion.
  if (!/^[a-z0-9-]+$/.test(clientId)) {
    throw new Error('clientId deve ter só letras minúsculas, números e hífens.');
  }
  if (opts.redes.length === 0) {
    throw new Error('Passa pelo menos uma rede com --instagram / --youtube / --tiktok / --linkedin.');
  }
  for (const r of opts.redes) {
    if (!PLATAFORMAS_VALIDAS.includes(r)) {
      throw new Error(`Rede "${r}" não suportada. Use: ${PLATAFORMAS_VALIDAS.join(', ')}.`);
    }
  }

  // Idempotência: se cliente já existe no Notion (mesmo slug), aborta antes
  // de criar Profile duplicado no Zernio.
  const existente = await buscarClientePorSlug(tenant, clientId);
  if (existente) {
    throw new Error(
      `Cliente "${clientId}" já existe (profileId=${existente.zernioProfileId}, status=${existente.status}).\n` +
        `Use --verificar-cliente ${clientId} pra checar conexões ou crie outro slug.`,
    );
  }

  const nome = opts.nome ?? clientId.charAt(0).toUpperCase() + clientId.slice(1);
  const zernio = zernioDo(tenant);

  onLog(`Criando Profile no Zernio: nome="${nome}"...`);
  const resp = await zernio.profiles.createProfile({ body: { name: nome } });
  const data = (resp as { data?: { profile?: { _id?: string } }; error?: { message?: string } });
  if (data.error) {
    throw new Error(`Zernio rejeitou createProfile: ${data.error.message ?? JSON.stringify(data.error)}`);
  }
  const zernioProfileId = data.data?.profile?._id;
  if (!zernioProfileId) {
    throw new Error('Zernio devolveu createProfile sem profile._id. Resposta: ' + JSON.stringify(resp).slice(0, 400));
  }
  onLog(`  ✓ profileId=${zernioProfileId}`);

  onLog(`\nGerando URLs OAuth pra ${opts.redes.length} rede(s)...`);
  const links: Array<{ rede: Rede; authUrl: string }> = [];
  for (const rede of opts.redes) {
    try {
      const r = await zernio.connect.getConnectUrl({
        path: { platform: PLATAFORMA_ZERNIO[rede] },
        query: {
          profileId: zernioProfileId,
          ...(opts.redirectUrl ? { redirect_url: opts.redirectUrl } : {}),
        },
      });
      const d = (r as { data?: { authUrl?: string }; error?: { message?: string } });
      if (d.error) {
        onLog(`  ❌ ${rede}: ${d.error.message ?? JSON.stringify(d.error)}`);
        continue;
      }
      const authUrl = d.data?.authUrl;
      if (!authUrl) {
        onLog(`  ❌ ${rede}: Zernio não devolveu authUrl.`);
        continue;
      }
      links.push({ rede, authUrl });
      onLog(`  ✓ ${rede}: link gerado`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onLog(`  ❌ ${rede}: ${msg}`);
    }
  }

  if (links.length === 0) {
    throw new Error('Nenhuma URL OAuth foi gerada. Verifica plano Zernio + plataformas.');
  }

  onLog(`\nGravando cliente no Notion (status="Pendente Conexão")...`);
  const { url: notionUrl } = await criarLinhaCliente(tenant, {
    clientId,
    nome,
    zernioProfileId,
    status: 'Pendente Conexão',
  });
  onLog(`  ✓ linha criada: ${notionUrl}`);

  return { clientId, zernioProfileId, notionPageUrl: notionUrl, links };
}
