import { UserButton } from '@clerk/nextjs';
import { EmpresaSelector } from './EmpresaSelector';

interface Props {
  empresas: Array<{ slug: string; nome: string }>;
  ativaSlug: string | null;
}

export function TopBar({ empresas, ativaSlug }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-bd/40 bg-app/80 px-6 backdrop-blur-md">
      <div className="flex flex-1 items-center gap-3">
        {ativaSlug !== null && (
          <EmpresaSelector empresas={empresas} ativaSlug={ativaSlug} />
        )}

        <div className="relative ml-2 hidden max-w-md flex-1 sm:block">
          <span
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted/60"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Buscar posts, clientes, redes…"
            className="h-8 w-full rounded-lg border border-bd/40 bg-surface/60 pl-8 pr-3 text-[13px] text-fg placeholder:text-fg-muted/55 focus:border-primary/60 focus:bg-surface focus:outline-none"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-bd/40 bg-app/60 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted/60">
            ⌘K
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8 rounded-full ring-1 ring-border-soft',
            },
          }}
        />
      </div>
    </header>
  );
}
