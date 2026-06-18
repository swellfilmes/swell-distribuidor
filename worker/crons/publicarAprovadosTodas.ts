import { publicarAprovados } from '@/src/maintenance/publicarAprovados';
import { paraCadaEmpresa } from './comum';

export async function publicarAprovadosTodas(): Promise<void> {
  await paraCadaEmpresa('publicar-aprovados', (tenant, log) =>
    publicarAprovados(tenant, log),
  );
}
