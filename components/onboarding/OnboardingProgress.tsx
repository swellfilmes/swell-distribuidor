'use client';

interface Props {
  passos: Array<{ id: string; label: string; completo: boolean; ativo: boolean }>;
}

export function OnboardingProgress({ passos }: Props) {
  return (
    <ol className="flex w-full items-center justify-between gap-1">
      {passos.map((p, i) => {
        const status = p.completo ? 'completo' : p.ativo ? 'ativo' : 'futuro';
        return (
          <li key={p.id} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  status === 'completo'
                    ? 'bg-success/15 text-success'
                    : status === 'ativo'
                      ? 'bg-primary text-app ring-2 ring-primary/30 ring-offset-2 ring-offset-app'
                      : 'bg-surface-2 text-fg-muted/60',
                ].join(' ')}
              >
                {p.completo ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <div
                className={[
                  'mt-2 hidden text-[10px] uppercase tracking-[0.15em] sm:block',
                  status === 'ativo' ? 'text-fg' : 'text-fg-muted/60',
                ].join(' ')}
              >
                {p.label}
              </div>
            </div>
            {i < passos.length - 1 && (
              <div
                className={[
                  'mx-2 h-px flex-1',
                  p.completo ? 'bg-success/50' : 'bg-bd/40',
                ].join(' ')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
