import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { OnboardingPendingBanner } from '@/components/OnboardingPendingBanner';
import { AceiteTermosGate } from '@/components/AceiteTermosGate';
import { syncUsuarioAtual, listarEmpresasDoUsuario } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import { temNotionConectado, temZernioConectado } from '@/src/tenant';

// Flag de kill-switch pro gate de termos. Se a coluna `termos_aceitos` ainda
// não foi criada no DB de produção (migration pendente), o gate quebra a
// experiência. Default: gate ATIVO. Setar TERMOS_GATE_OFF=1 no Vercel/Railway
// pra desligar temporariamente. Reabilita removendo a env quando o
// `db:push` tiver rodado contra o DB certo.
const TERMOS_GATE_ATIVO = process.env.TERMOS_GATE_OFF !== '1';

// Sem isso, Next 16 podia cachear o layout entre requests e o banner
// "ainda precisa conectar Zernio" ficava preso mesmo após o testador
// conectar uma rede (estado novo no banco não era lido).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  // Gate de aceite dos Termos/Privacidade. SSR já sabe se o user aceitou
  // (vem do upsert no banco) — passamos como prop pra evitar piscar a tela
  // do app antes do client buscar o status. Se ainda não aceitou, o gate
  // bloqueia em fullscreen e impede qualquer interação com a sidebar/app.
  // Quando TERMOS_GATE_OFF=1, ignora o estado e libera o app (kill-switch
  // pra emergência tipo coluna pendente em prod).
  const jaAceitouTermos = !TERMOS_GATE_ATIVO || Boolean(user.termosAceitosEm);

  const conteudo = (
    <div className="flex min-h-screen bg-app text-fg">
      <Sidebar isAdmin={user.role === 'admin'} />
      <div className="flex min-w-0 flex-1 flex-col">
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
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );

  if (!TERMOS_GATE_ATIVO) return conteudo;

  return (
    <AceiteTermosGate jaAceito={jaAceitouTermos}>{conteudo}</AceiteTermosGate>
  );
}
