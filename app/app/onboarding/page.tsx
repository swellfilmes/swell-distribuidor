import { redirect } from 'next/navigation';
import {
  listarEmpresasDoUsuario,
  syncUsuarioAtual,
} from '@/lib-web/auth';
import { carregarEmpresaDetalhada } from '@/lib-web/adminEmpresas';
import { OnboardingWizard } from '@/components/OnboardingWizard';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ empresa?: string }>;
}

export default async function OnboardingPage({ searchParams }: Props) {
  const user = await syncUsuarioAtual();
  if (!user) redirect('/sign-in?redirect_url=/app/onboarding');

  const { empresa: empresaIdStr } = await searchParams;
  const empresasDoUser = await listarEmpresasDoUsuario();

  // Resolve qual empresa onboarding aplicar:
  // 1) ?empresa=X explícito → valida que user é membro
  // 2) Senão, se user tem só 1 empresa → usa essa
  // 3) Múltiplas empresas → mostra seletor (fora do escopo, redireciona pra /app)
  let empresaId: number | null = null;
  if (empresaIdStr) {
    const n = parseInt(empresaIdStr, 10);
    if (Number.isFinite(n) && empresasDoUser.some((e) => e.id === n)) {
      empresaId = n;
    }
  } else if (empresasDoUser.length === 1) {
    empresaId = empresasDoUser[0].id;
  }

  if (!empresaId) {
    // Sem empresa ou ambígua — manda pro app principal
    redirect('/app');
  }

  // Carrega detalhes (admin? não precisa — owner já pode ler a própria empresa).
  // Como carregarEmpresaDetalhada não checa role, ok ler aqui — mas pra evitar
  // expor segredos de outras empresas, já filtramos empresaId acima.
  const detalhe = await carregarEmpresaDetalhada(empresaId);
  if (!detalhe) redirect('/app');

  // Reverifica permissão: user precisa ser membro dessa empresa.
  const ehMembro = empresasDoUser.some((e) => e.id === empresaId);
  if (!ehMembro) redirect('/app');

  const notionPronto = Boolean(detalhe.notionApiKey && detalhe.notionDbId);
  const zernioPronto = Boolean(detalhe.zernioApiKey);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-white to-amber-50/40 px-4 py-6 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <OnboardingWizard
          empresaId={detalhe.id}
          empresaNome={detalhe.nome}
          empresaSlug={detalhe.slug}
          notionPronto={notionPronto}
          notionDbId={detalhe.notionDbId}
          zernioPronto={zernioPronto}
          zernioYoutubeAccountId={detalhe.zernioYoutubeAccountId}
          zernioInstagramAccountId={detalhe.zernioInstagramAccountId}
          zernioTiktokAccountId={detalhe.zernioTiktokAccountId}
          zernioLinkedinAccountId={detalhe.zernioLinkedinAccountId}
        />
      </div>
    </div>
  );
}
