import { listarEmpresasAtivas, loadTenantConfigById } from '@/src/db/tenantConfig';
import type { TenantConfig } from '@/src/config';

/**
 * Roda uma rotina pra cada empresa ativa, isolando erros — uma empresa que
 * quebra não impede as outras de rodarem.
 */
export async function paraCadaEmpresa(
  nomeCron: string,
  rotina: (tenant: TenantConfig, onLog: (msg: string) => void) => Promise<void>,
): Promise<void> {
  const hora = new Date().toLocaleTimeString('pt-BR');
  console.log(`\n[${hora}] [cron ${nomeCron}] iniciando ciclo...`);
  let empresas: Awaited<ReturnType<typeof listarEmpresasAtivas>>;
  try {
    empresas = await listarEmpresasAtivas();
  } catch (err) {
    console.error(`[cron ${nomeCron}] ❌ falhou listando empresas:`, err);
    return;
  }
  if (empresas.length === 0) {
    console.log(`[cron ${nomeCron}] (nenhuma empresa ativa)`);
    return;
  }
  for (const e of empresas) {
    const tag = `${nomeCron}:${e.slug}`;
    try {
      const tenant = await loadTenantConfigById(e.id);
      await rotina(tenant, (m) => console.log(`  [${tag}] ${m}`));
    } catch (err) {
      const msg = err instanceof Error ? err.stack ?? err.message : String(err);
      console.error(`  [${tag}] ❌ erro:`, msg.split('\n')[0]);
    }
  }
  const horaFim = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${horaFim}] [cron ${nomeCron}] ciclo concluído.`);
}
