import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirAdmin } from '@/lib-web/auth';
import { listarEmpresasAdmin } from '@/lib-web/adminEmpresas';
import { listarConvitesOnboarding } from '@/lib-web/convitesOnboarding';
import { formatarData } from '@/lib-web/format';
import { ConvitesOnboardingPanel } from '@/components/ConvitesOnboardingPanel';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  try {
    await exigirAdmin();
  } catch {
    redirect('/app');
  }

  const [empresas, convites] = await Promise.all([
    listarEmpresasAdmin(),
    listarConvitesOnboarding(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin · Empresas</h1>
          <p className="text-sm text-ink/60">
            Cada empresa traz suas próprias chaves Notion e Zernio.
          </p>
        </div>
        <Link
          href="/app/admin/empresas/nova"
          className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-cream hover:opacity-90"
        >
          + Nova empresa
        </Link>
      </header>

      <div className="grid gap-3">
        {empresas.length === 0 && (
          <div className="rounded-lg border border-dashed border-ink/20 bg-white/50 p-10 text-center text-sm text-ink/50">
            Nenhuma empresa ainda. Clica em "+ Nova empresa" pra começar.
          </div>
        )}
        {empresas.map((e) => (
          <Link
            key={e.id}
            href={`/app/admin/empresas/${e.id}`}
            className="flex items-center justify-between rounded-lg border border-ink/10 bg-white p-4 hover:bg-ink/[0.02]"
          >
            <div>
              <h2 className="text-base font-medium">
                {e.nome}{' '}
                <span className="ml-2 text-xs font-normal text-ink/50">
                  {e.slug}
                </span>
              </h2>
              <p className="mt-1 text-xs text-ink/55">
                {e.numMembros} membro(s)
                {e.numConvitesPendentes > 0 &&
                  ` · ${e.numConvitesPendentes} convite(s) pendente(s)`}{' '}
                · criada em {formatarData(e.criadaEm.toISOString())}
              </p>
            </div>
            <div>
              {e.ativo ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                  Ativa
                </span>
              ) : (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800">
                  Desativada
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-base font-medium">Convites de onboarding</h2>
        <p className="mb-4 text-sm text-ink/60">
          Gera um link único pra alguém criar a empresa dele do zero (signup +
          conectar Notion + Zernio). Cada link é de uso único.
        </p>
        <ConvitesOnboardingPanel inicial={convites} />
      </section>
    </div>
  );
}
