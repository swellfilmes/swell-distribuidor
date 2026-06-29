import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { OnboardingPendingBanner } from '@/components/OnboardingPendingBanner';
import { syncUsuarioAtual, listarEmpresasDoUsuario } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import { temNotionConectado, temZernioConectado } from '@/src/tenant';

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

  // Detecta se a empresa ativa ainda tá em onboarding (Notion OU Zernio faltando).
  // Carregar tenant é barato (cacheado em memória pelo loadTenantConfig).
  // Falha silenciosa: se quebrar, banner não aparece — não é crítico.
  let onboardingPendente: {
    empresaId: number;
    empresaNome: string;
    notionPronto: boolean;
    zernioPronto: boolean;
  } | null = null;
  if (ativa) {
    try {
      const tenant = await loadTenantConfig(ativa.slug);
      const notionPronto = temNotionConectado(tenant);
      const zernioPronto = temZernioConectado(tenant);
      if (!notionPronto || !zernioPronto) {
        onboardingPendente = {
          empresaId: tenant.empresaId,
          empresaNome: tenant.nome,
          notionPronto,
          zernioPronto,
        };
      }
    } catch {
      // se loadTenantConfig falhar, segue sem banner — outras telas já vão sinalizar
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={user.role === 'admin'} />
      <div className="flex flex-1 flex-col">
        <TopBar
          empresas={empresas.map((e) => ({ slug: e.slug, nome: e.nome }))}
          ativaSlug={ativa?.slug ?? null}
        />
        {onboardingPendente && (
          <OnboardingPendingBanner
            empresaId={onboardingPendente.empresaId}
            empresaNome={onboardingPendente.empresaNome}
            notionPronto={onboardingPendente.notionPronto}
            zernioPronto={onboardingPendente.zernioPronto}
          />
        )}
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
