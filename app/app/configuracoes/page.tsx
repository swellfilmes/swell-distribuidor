import { Suspense } from 'react';
import Link from 'next/link';
import { syncUsuarioAtual, listarEmpresasDoUsuario } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { carregarEmpresaDetalhada } from '@/lib-web/adminEmpresas';
import { NotionConnectButton } from '@/components/NotionConnectButton';
import { ZernioEditor } from '@/components/ZernioEditor';
import { StepZernio } from '@/components/onboarding/StepZernio';

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  const user = await syncUsuarioAtual();
  const empresas = await listarEmpresasDoUsuario();
  const ativa = await getEmpresaAtiva();

  // Detalhes da empresa ativa pra mostrar status das integrações + editar
  const detalhe = ativa ? await carregarEmpresaDetalhada(ativa.id) : null;
  const notionPronto = Boolean(detalhe?.notionApiKey && detalhe?.notionDbId);
  const zernioPronto = Boolean(detalhe?.zernioApiKey);
  const setupCompleto = notionPronto && zernioPronto;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-fg-muted/60">
          Seu perfil, empresas que você acessa, e as integrações da empresa ativa.
        </p>
      </header>

      <section className="rounded-lg border border-bd/10 bg-surface p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-fg-muted/60">
          Seu perfil
        </h2>
        <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-fg-muted/60">Nome</dt>
          <dd>{user?.nome ?? '—'}</dd>
          <dt className="text-fg-muted/60">Email</dt>
          <dd>{user?.email}</dd>
          <dt className="text-fg-muted/60">Role</dt>
          <dd>{user?.role}</dd>
        </dl>
      </section>

      <section className="rounded-lg border border-bd/10 bg-surface p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-fg-muted/60">
          Empresas que você acessa
        </h2>
        {empresas.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted/60">Nenhuma vinculada ainda.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {empresas.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span>
                  {e.nome}{' '}
                  {ativa?.slug === e.slug && (
                    <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      ativa
                    </span>
                  )}
                </span>
                <span className="text-xs uppercase tracking-wide text-fg-muted/40">
                  {e.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detalhe && (
        <>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-medium">
                Integrações de <span className="font-semibold">{detalhe.nome}</span>
              </h2>
              {!setupCompleto && (
                <Link
                  href={`/app/onboarding?empresa=${detalhe.id}`}
                  className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                >
                  Continuar onboarding →
                </Link>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted/60">
                  Notion
                </div>
                <Suspense fallback={null}>
                  <NotionConnectButton
                    empresaId={detalhe.id}
                    jaConectado={notionPronto}
                    dbId={detalhe.notionDbId}
                  />
                </Suspense>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted/60">
                  Redes sociais (Zernio)
                </div>
                {/* Empresa-testador (sem zernioApiKey própria) usa o fluxo novo
                    de Profiles + links OAuth. Swell legacy continua com o
                    editor manual de API key + account IDs. */}
                {!detalhe.zernioApiKey ? (
                  <Suspense fallback={null}>
                    <StepZernio
                      empresaId={detalhe.id}
                      zernioPronto={zernioPronto}
                      zernioYoutubeAccountId={detalhe.zernioYoutubeAccountId || null}
                      zernioInstagramAccountId={detalhe.zernioInstagramAccountId || null}
                      zernioTiktokAccountId={detalhe.zernioTiktokAccountId || null}
                      zernioLinkedinAccountId={detalhe.zernioLinkedinAccountId || null}
                      onAvancar={() => {}}
                    />
                  </Suspense>
                ) : (
                <ZernioEditor
                  empresaId={detalhe.id}
                  zernioPronto={zernioPronto}
                  zernioYoutubeAccountId={detalhe.zernioYoutubeAccountId}
                  zernioInstagramAccountId={detalhe.zernioInstagramAccountId}
                  zernioTiktokAccountId={detalhe.zernioTiktokAccountId}
                  zernioLinkedinAccountId={detalhe.zernioLinkedinAccountId}
                  mostrarInstrucoes={false}
                />
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
