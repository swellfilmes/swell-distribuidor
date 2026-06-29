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
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-amber-900">
          <span className="mr-1">⚠️</span>
          <span className="font-medium">{empresaNome}</span> ainda precisa conectar{' '}
          <b>{faltam.join(' e ')}</b> pra publicar de verdade.
        </div>
        <Link
          href={`/app/onboarding?empresa=${empresaId}`}
          className="shrink-0 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-800"
        >
          Continuar onboarding →
        </Link>
      </div>
    </div>
  );
}
