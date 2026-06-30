import Link from 'next/link';

interface Props {
  empresaId: number;
  empresaNome: string;
  notionPronto: boolean;
  zernioPronto: boolean;
}

/**
 * Banner que aparece no topo do layout /app/* quando a empresa ativa ainda
 * não terminou de conectar Notion + Zernio. Permite o testador retomar o
 * onboarding de qualquer página, sem precisar do link de convite original.
 */
export function OnboardingPendingBanner({
  empresaId,
  empresaNome,
  notionPronto,
  zernioPronto,
}: Props) {
  const faltam: string[] = [];
  if (!notionPronto) faltam.push('Notion');
  if (!zernioPronto) faltam.push('Zernio');
  if (faltam.length === 0) return null;

  return (
    <div className="border-b border-primary/25 bg-primary/8 px-4 py-2.5 text-[13px] sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-fg/90">
          <span className="mr-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="font-medium">{empresaNome}</span> ainda precisa conectar{' '}
          <b className="text-primary">{faltam.join(' e ')}</b> pra publicar.
        </div>
        <Link
          href={`/app/onboarding?empresa=${empresaId}`}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-app hover:opacity-90"
        >
          Continuar onboarding →
        </Link>
      </div>
    </div>
  );
}
