import { Suspense } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { exigirAdmin } from '@/lib-web/auth';
import { carregarEmpresaDetalhada } from '@/lib-web/adminEmpresas';
import { EmpresaForm } from '@/components/EmpresaForm';
import { MembrosManager } from '@/components/MembrosManager';
import { ToggleAtivo } from '@/components/ToggleAtivo';
import { NotionConnectButton } from '@/components/NotionConnectButton';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmpresaDetalhe({ params }: Props) {
  try {
    await exigirAdmin();
  } catch {
    redirect('/app');
  }
  const { id } = await params;
  const n = parseInt(id, 10);
  if (!Number.isFinite(n)) notFound();
  const empresa = await carregarEmpresaDetalhada(n);
  if (!empresa) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <Link href="/app/admin" className="text-xs text-fg-muted/55 hover:underline">
          ← Voltar
        </Link>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{empresa.nome}</h1>
            <p className="text-sm text-fg-muted/60">
              slug: <code>{empresa.slug}</code> · id: {empresa.id}
            </p>
          </div>
          <ToggleAtivo empresaId={empresa.id} ativo={empresa.ativo} />
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-base font-medium">Chaves & integrações</h2>
        <Suspense fallback={null}>
          <NotionConnectButton
            empresaId={empresa.id}
            jaConectado={Boolean(empresa.notionApiKey && empresa.notionDbId)}
            dbId={empresa.notionDbId}
          />
        </Suspense>
        <div className="mt-4" />
        <EmpresaForm
          modo="editar"
          empresaId={empresa.id}
          inicial={{
            nome: empresa.nome,
            slug: empresa.slug,
            notionApiKey: empresa.notionApiKey,
            notionDbId: empresa.notionDbId,
            zernioApiKey: empresa.zernioApiKey,
            zernioYoutubeAccountId: empresa.zernioYoutubeAccountId ?? '',
            zernioInstagramAccountId: empresa.zernioInstagramAccountId ?? '',
            zernioTiktokAccountId: empresa.zernioTiktokAccountId ?? '',
            zernioLinkedinAccountId: empresa.zernioLinkedinAccountId ?? '',
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-base font-medium">Membros & convites</h2>
        <MembrosManager
          empresaId={empresa.id}
          membros={empresa.membros}
          convites={empresa.convitesPendentes.map((c) => ({
            id: c.id,
            email: c.email,
            role: c.role,
            criadoEm: c.criadoEm,
          }))}
        />
      </section>
    </div>
  );
}
