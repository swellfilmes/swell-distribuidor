import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { validarConviteOnboarding } from '@/lib-web/convitesOnboarding';
import { ConviteOnboardingUI } from '@/components/ConviteOnboardingUI';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PaginaConvite({ params }: Props) {
  const { token } = await params;
  const validacao = await validarConviteOnboarding(token);
  const { userId } = await auth();
  const jaLogado = Boolean(userId);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-white to-amber-50 px-4 py-8 sm:py-16">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="text-center">
          <div className="mb-2 text-xs uppercase tracking-widest text-ink/55">
            Swell Distribuidor
          </div>
          <h1 className="text-3xl font-semibold leading-tight">
            Você foi convidado(a) a testar
          </h1>
          <p className="mt-2 text-sm text-ink/65">
            Crie sua conta e configure sua empresa em ~5 minutos.
          </p>
        </header>

        {!validacao.ok ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm">
            <div className="mb-1 font-medium text-red-900">
              {validacao.motivo === 'ja-consumido'
                ? 'Este convite já foi usado'
                : 'Convite inválido ou não encontrado'}
            </div>
            <p className="text-red-800/80">
              {validacao.motivo === 'ja-consumido'
                ? 'Cada link de convite só pode ser usado uma vez. Peça um novo pra quem te enviou.'
                : 'Verifique se você copiou o link inteiro. Se o link estiver certo, peça um novo pra quem te enviou.'}
            </p>
            <div className="mt-4">
              <Link
                href="/"
                className="text-xs text-red-900 underline"
              >
                Voltar pra página inicial
              </Link>
            </div>
          </div>
        ) : (
          <ConviteOnboardingUI
            token={token}
            jaLogado={jaLogado}
            emailSugerido={validacao.emailSugerido}
            nomeEmpresaSugerido={validacao.nomeEmpresaSugerido}
          />
        )}
      </div>
    </div>
  );
}
