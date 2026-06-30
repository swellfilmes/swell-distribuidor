'use client';

interface Props {
  passos: Array<{ id: string; label: string; completo: boolean; ativo: boolean }>;
}

export function OnboardingProgress({ passos }: Props) {
  return (
    <div className="w-full">
      <ol className="flex w-full items-center justify-between gap-1">
        {passos.map((p, i) => {
          const status = p.completo ? 'completo' : p.ativo ? 'ativo' : 'futuro';
          return (
            <li key={p.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ring-2 ring-offset-2 ring-offset-amber-50/40',
                    status === 'completo'
                      ? 'bg-emerald-500 text-white ring-emerald-500'
                      : status === 'ativo'
                        ? 'bg-primary text-app ring-primary'
                        : 'bg-surface text-fg-muted/40 ring-primary/15',
                  ].join(' ')}
                >
                  {p.completo ? '✓' : i + 1}
                </div>
                <div
                  className={[
                    'mt-1.5 hidden text-[10px] uppercase tracking-wide sm:block',
                    status === 'ativo' ? 'text-fg' : 'text-fg-muted/50',
                  ].join(' ')}
                >
                  {p.label}
                </div>
              </div>
              {i < passos.length - 1 && (
                <div
                  className={[
                    'mx-1 h-0.5 flex-1 rounded',
                    p.completo ? 'bg-emerald-500' : 'bg-primary/15',
                  ].join(' ')}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
