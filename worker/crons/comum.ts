import { listarEmpresasAtivas, loadTenantConfigById } from '@/src/db/tenantConfig';
import { integracoesCompletas, type TenantConfig } from '@/src/config';
import { pingHealthcheck } from '@/src/lib/healthcheck';

/**
 * Cada cron pode mapear pra uma URL Healthchecks.io: HEALTHCHECKS_<NOME>_URL.
 * Ex: cron "publicar-aprovados" → env HEALTHCHECKS_PUBLICAR_APROVADOS_URL.
 * Sem URL, não pinga (sem ruído nos crons locais).
 */
function urlHealthcheckDo(nomeCron: string): string | undefined {
  const slug = nomeCron.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
  return process.env[`HEALTHCHECKS_${slug}_URL`];
}

/**
 * Roda uma rotina pra cada empresa ativa, isolando erros — uma empresa que
 * quebra não impede as outras de rodarem. Empresas em onboarding (sem
 * Notion E Zernio conectados) são puladas com log discreto.
 */
export async function paraCadaEmpresa(
  nomeCron: string,
  rotina: (tenant: TenantConfig, onLog: (msg: string) => void) => Promise<void>,
): Promise<void> {
  const urlHc = urlHealthcheckDo(nomeCron);
  await pingHealthcheck(urlHc, 'start');
  let saiuComErro = false;
  const hora = new Date().toLocaleTimeString('pt-BR');
  console.log(`\n[${hora}] [cron ${nomeCron}] iniciando ciclo...`);
  let empresas: Awaited<ReturnType<typeof listarEmpresasAtivas>>;
  try {
    empresas = await listarEmpresasAtivas();
  } catch (err) {
    console.error(`[cron ${nomeCron}] ❌ falhou listando empresas:`, err);
    await pingHealthcheck(urlHc, 'fail');
    return;
  }
  if (empresas.length === 0) {
    console.log(`[cron ${nomeCron}] (nenhuma empresa ativa)`);
    await pingHealthcheck(urlHc, 'success');
    return;
  }
  let puladas = 0;
  for (const e of empresas) {
    const tag = `${nomeCron}:${e.slug}`;
    try {
      const tenant = await loadTenantConfigById(e.id);
      if (!integracoesCompletas(tenant)) {
        puladas++;
        continue;
      }
      await rotina(tenant, (m) => console.log(`  [${tag}] ${m}`));
    } catch (err) {
      saiuComErro = true;
      const msg = err instanceof Error ? err.stack ?? err.message : String(err);
      console.error(`  [${tag}] ❌ erro:`, msg.split('\n')[0]);
    }
  }
  if (puladas > 0) {
    console.log(`  [${nomeCron}] (${puladas} empresa(s) puladas — onboarding incompleto)`);
  }
  const horaFim = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${horaFim}] [cron ${nomeCron}] ciclo concluído.`);
  await pingHealthcheck(urlHc, saiuComErro ? 'fail' : 'success');
}
