import { Suspense } from 'react';
import Link from 'next/link';
import { syncUsuarioAtual, listarEmpresasDoUsuario } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { carregarEmpresaDetalhada } from '@/lib-web/adminEmpresas';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import { temNotionConectado, temZernioConectado } from '@/src/tenant';
import { NotionConnectButton } from '@/components/NotionConnectButton';
import { StepZernio } from '@/components/onboarding/StepZernio';
import { TomVozEditor } from '@/components/TomVozEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ConfiguracoesPage() {
  const user = await syncUsuarioAtual();
  const empresas = await listarEmpresasDoUsuario();
  const ativa = await getEmpresaAtiva();

  const detalhe = ativa ? await carregarEmpresaDetalhada(ativa.id) : null;

  // Usa o helper Profile-aware (mesmo do dashboard) pra refletir estado real.
  let notionPronto = false;
  let zernioPronto = false;
  if (ativa) {
    try {
      const tenant = await loadTenantConfig(ativa.slug);
      notionPronto = temNotionConectado(tenant);
      zernioPronto = temZernioConectado(tenant);
    } catch {}
  }
  const setupCompleto = notionPronto && zernioPronto;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="font-serif text-3xl text-fg">Configurações</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Seu perfil, empresas que você acessa, e as integrações da empresa ativa.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-bd/40 bg-surface/40">
        <header className="border-b border-bd/40 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-fg-muted">
          Seu perfil
        </header>
        <dl className="grid grid-cols-[120px_1fr] gap-y-3 px-5 py-4 text-sm">
          <dt className="text-fg-muted">Nome</dt>
          <dd className="text-fg">{user?.nome ?? '—'}</dd>
          <dt className="text-fg-muted">Email</dt>
          <dd className="text-fg">{user?.email}</dd>
          <dt className="text-fg-muted">Role</dt>
          <dd className="text-fg">{user?.role}</dd>
        </dl>
      </section>

      <section className="overflow-hidden rounded-2xl border border-bd/40 bg-surface/40">
        <header className="border-b border-bd/40 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-fg-muted">
          Empresas que você acessa
        </header>
        {empresas.length === 0 ? (
          <p className="px-5 py-4 text-sm text-fg-muted">Nenhuma vinculada ainda.</p>
        ) : (
          <ul className="divide-y divide-bd/40">
            {empresas.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="flex items-center gap-2 text-fg">
                  {e.nome}
                  {ativa?.slug === e.slug && (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                      ativa
                    </span>
                  )}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-fg-muted">
                  {e.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detalhe && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium text-fg">
              Integrações <span className="text-fg-muted">de {detalhe.nome}</span>
            </h2>
            {!setupCompleto && (
              <Link
                href={`/app/onboarding?empresa=${detalhe.id}`}
                className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary transition-opacity hover:opacity-90"
              >
                Continuar onboarding →
              </Link>
            )}
          </div>

          <div className="space-y-4">
            <Suspense fallback={null}>
              <NotionConnectButton
                empresaId={detalhe.id}
                jaConectado={notionPronto}
                dbId={detalhe.notionDbId}
              />
            </Suspense>

            <div className="rounded-2xl border border-bd/40 bg-surface/40 p-5">
              <Suspense fallback={null}>
                <StepZernio
                  empresaId={detalhe.id}
                  zernioPronto={zernioPronto}
                  zernioYoutubeAccountId={detalhe.zernioYoutubeAccountId || null}
                  zernioInstagramAccountId={detalhe.zernioInstagramAccountId || null}
                  zernioTiktokAccountId={detalhe.zernioTiktokAccountId || null}
                  zernioLinkedinAccountId={detalhe.zernioLinkedinAccountId || null}
                />
              </Suspense>
            </div>
          </div>
        </section>
      )}

      {ativa && (
        <TomVozEditor podeEditar={ativa.role === 'owner' || user?.role === 'admin'} />
      )}
    </div>
  );
}
