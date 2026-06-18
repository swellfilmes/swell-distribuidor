import { atualizarPendentes } from '@/src/maintenance/atualizarPendentes';
import { paraCadaEmpresa } from './comum';

export async function atualizarPendentesTodas(): Promise<void> {
  await paraCadaEmpresa('atualizar-pendentes', (tenant, log) =>
    atualizarPendentes(tenant, log),
  );
}
