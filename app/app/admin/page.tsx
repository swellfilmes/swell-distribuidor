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
          <h1 className="font-serif text-3xl text-fg">Admin</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Cada empresa traz suas próprias integrações Notion + redes via Profile do Zernio.
          </p>
        </div>
        <Link
          href="/app/admin/empresas/nova"
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-app transition-opacity hover:opacity-90"
        >
          Nova empresa
        </Link>
      </header>

      <section>
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-fg-muted">
            Empresas ({empresas.length})
          </h2>
        </header>
        <div className="grid gap-2">
          {empresas.length === 0 && (
            <div className="rounded-2xl border border-dashed border-bd/40 bg-surface/30 p-10 text-center text-sm text-fg-muted">
              Nenhuma empresa ainda. Clica em "Nova empresa" pra começar.
            </div>
          )}
          {empresas.map((e) => (
            <Link
              key={e.id}
              href={`/app/admin/empresas/${e.id}`}
              className="group flex items-center justify-between rounded-xl border border-bd/40 bg-surface/40 p-4 transition-colors hover:border-bd/70 hover:bg-surface-2/60"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-[15px] font-medium text-fg">{e.nome}</h2>
                  <span className="font-mono text-xs text-fg-muted">{e.slug}</span>
                </div>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {e.numMembros} membro{e.numMembros === 1 ? '' : 's'}
                  {e.numConvitesPendentes > 0 &&
                    ` · ${e.numConvitesPendentes} convite${e.numConvitesPendentes === 1 ? '' : 's'} pendente${e.numConvitesPendentes === 1 ? '' : 's'}`}
                  {' · '}
                  criada em {formatarData(e.criadaEm.toISOString())}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {e.ativo ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                    ativa
                  </span>
                ) : (
                  <span className="rounded-full bg-error/15 px-2 py-0.5 text-[10px] font-medium text-error">
                    inativa
                  </span>
                )}
                <span className="text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <header className="mb-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-fg-muted">
            Convites de onboarding
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            Gere um link único pra alguém criar a empresa dele do zero (signup +
            conectar Notion + Zernio). Cada link é de uso único.
          </p>
        </header>
        <ConvitesOnboardingPanel inicial={convites} />
      </section>
    </div>
  );
}
