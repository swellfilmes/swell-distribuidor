import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { syncUsuarioAtual, listarEmpresasDoUsuario } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await syncUsuarioAtual();
  if (!user) redirect('/sign-in');

  const [empresas, ativa] = await Promise.all([
    listarEmpresasDoUsuario(),
    getEmpresaAtiva(),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={user.role === 'admin'} />
      <div className="flex flex-1 flex-col">
        <TopBar
          empresas={empresas.map((e) => ({ slug: e.slug, nome: e.nome }))}
          ativaSlug={ativa?.slug ?? null}
        />
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
