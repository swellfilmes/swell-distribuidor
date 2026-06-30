import { zernioDo } from '../lib/clients';
import type { TenantConfig } from '../tenant';
import type { Rede } from '../types';
import { atualizarAccountIds, buscarClientePorSlug } from './notionClientes';

interface ContaZernio {
  _id?: string;
  platform?: string;
  username?: string;
  displayName?: string;
  isActive?: boolean;
}

const REDES_RASTREAVEIS: ReadonlyArray<Rede> = ['instagram', 'youtube', 'tiktok', 'linkedin'];

export interface VerificarClienteResultado {
  clientId: string;
  zernioProfileId: string;
  conectadas: Partial<Record<Rede, { id: string; username?: string; displayName?: string }>>;
  pendentes: Rede[];
  /** Status final que escrevi no Notion. */
  novoStatus: 'Pendente Conexão' | 'Ativo';
}

export async function executarVerificarCliente(
  tenant: TenantConfig,
  clientId: string,
  onLog: (msg: string) => void = (m) => console.log(m),
): Promise<VerificarClienteResultado> {
  const cliente = await buscarClientePorSlug(tenant, clientId);
  if (!cliente) {
    throw new Error(`Cliente "${clientId}" não existe no Notion. Use --novo-cliente ${clientId} primeiro.`);
  }
  if (!cliente.zernioProfileId) {
    throw new Error(`Cliente "${clientId}" sem ZernioProfileId no Notion. Manualmente arrumar a linha ou recriar.`);
  }
  onLog(`Cliente: ${cliente.nome} (profileId=${cliente.zernioProfileId})`);

  const zernio = zernioDo(tenant);
  onLog(`\nListando contas do Profile via Zernio (filter profileId)...`);
  const resp = await zernio.accounts.listAccounts({
    query: { profileId: cliente.zernioProfileId },
  });
  const data = (resp as { data?: { accounts?: ContaZernio[] }; error?: { message?: string } });
  if (data.error) {
    throw new Error(`Zernio rejeitou listAccounts: ${data.error.message ?? JSON.stringify(data.error)}`);
  }
  const contas = data.data?.accounts ?? [];
  onLog(`  ${contas.length} conta(s) encontrada(s) nesse Profile.`);

  const conectadas: VerificarClienteResultado['conectadas'] = {};
  for (const c of contas) {
    if (!c.platform || !c._id) continue;
    const p = c.platform as Rede;
    if (!REDES_RASTREAVEIS.includes(p)) {
      onLog(`  ⏭️  plataforma "${p}" não rastreada por esse sistema, pulando.`);
      continue;
    }
    if (c.isActive === false) {
      onLog(`  ⚠️  ${p}: conta ${c.username ?? c._id} marcada isActive=false no Zernio, ignorando.`);
      continue;
    }
    conectadas[p] = {
      id: c._id,
      username: c.username,
      displayName: c.displayName,
    };
  }

  const pendentes: Rede[] = REDES_RASTREAVEIS.filter((r) => !conectadas[r]);

  onLog(`\nStatus por plataforma:`);
  for (const r of REDES_RASTREAVEIS) {
    const c = conectadas[r];
    if (c) {
      onLog(`  ✓ ${r.padEnd(10)} → @${c.username ?? c.displayName ?? '?'} (id=${c.id})`);
    } else {
      onLog(`  ⏳ ${r.padEnd(10)} → pendente`);
    }
  }

  const novoStatus: 'Pendente Conexão' | 'Ativo' =
    Object.keys(conectadas).length > 0 ? 'Ativo' : 'Pendente Conexão';

  onLog(`\nAtualizando Notion (status="${novoStatus}", accountIds detectados)...`);
  // Pra cada rede: escreve o id se conectada, OU string vazia se pendente
  // (limpa qualquer accountId antigo que tenha desconectado nesse meio tempo).
  const accountIds: Partial<Record<Rede, string>> = {};
  for (const r of REDES_RASTREAVEIS) {
    accountIds[r] = conectadas[r]?.id ?? '';
  }
  await atualizarAccountIds(tenant, cliente.pageId, accountIds, novoStatus);
  onLog(`  ✓ Notion atualizado.`);

  return {
    clientId,
    zernioProfileId: cliente.zernioProfileId,
    conectadas,
    pendentes,
    novoStatus,
  };
}
