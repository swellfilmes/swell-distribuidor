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
    <div className="relative min-h-dvh bg-app px-4 py-12 sm:py-20">
      {/* Glow ambiente discreto */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-md space-y-8">
        <header className="text-center">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M3 12c3 0 3-4 6-4s3 4 6 4 3-4 6-4" />
              <path d="M3 18c3 0 3-4 6-4s3 4 6 4 3-4 6-4" />
            </svg>
          </div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-fg-muted">
            Swell Mermaid
          </div>
          <h1 className="font-serif text-[32px] leading-tight text-fg">
            Você foi convidado a testar
          </h1>
          <p className="mt-3 text-[14px] text-fg-muted">
            Crie sua conta e configure sua empresa em ~5 minutos.
          </p>
        </header>

        {!validacao.ok ? (
          <div className="rounded-2xl border border-error/30 bg-error/8 p-5 text-sm">
            <div className="mb-2 font-medium text-error">
              {validacao.motivo === 'ja-consumido'
                ? 'Este convite já foi usado'
                : 'Convite inválido ou não encontrado'}
            </div>
            <p className="text-fg-muted">
              {validacao.motivo === 'ja-consumido'
                ? 'Cada link de convite só pode ser usado uma vez. Peça um novo pra quem te enviou.'
                : 'Verifique se você copiou o link inteiro. Se o link estiver certo, peça um novo pra quem te enviou.'}
            </p>
            <div className="mt-4">
              <Link
                href="/"
                className="text-xs text-fg underline-offset-4 hover:underline"
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
