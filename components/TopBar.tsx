import { UserButton } from '@clerk/nextjs';
import { EmpresaSelector } from './EmpresaSelector';

interface Props {
  empresas: Array<{ slug: string; nome: string }>;
  ativaSlug: string | null;
}

export function TopBar({ empresas, ativaSlug }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-ink/10 bg-cream/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-6">
        <span className="text-sm font-medium text-ink/70 md:hidden">Swell</span>
        {ativaSlug !== null && (
          <EmpresaSelector empresas={empresas} ativaSlug={ativaSlug} />
        )}
      </div>
      <UserButton appearance={{ elements: { avatarBox: 'w-9 h-9' } }} />
    </header>
  );
}
