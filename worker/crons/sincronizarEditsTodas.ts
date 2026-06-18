import { atualizarZernioAgendadosAte } from '@/src/maintenance/atualizarZernioAgendados';
import { paraCadaEmpresa } from './comum';

export async function sincronizarEditsTodas(): Promise<void> {
  await paraCadaEmpresa('sincronizar-edits', (tenant, log) =>
    atualizarZernioAgendadosAte(tenant, undefined, log),
  );
}
