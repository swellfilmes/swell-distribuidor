'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface EmpresaItem {
  slug: string;
  nome: string;
}

interface Props {
  empresas: EmpresaItem[];
  ativaSlug: string;
}

export function EmpresaSelector({ empresas, ativaSlug }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (empresas.length === 0) {
    return (
      <div className="text-sm text-fg-muted/60">
        Nenhuma empresa vinculada à sua conta.
      </div>
    );
  }

  const trocar = (slug: string) => {
    if (slug === ativaSlug) return;
    startTransition(async () => {
      await fetch('/api/me/empresa-ativa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <select
        className="appearance-none rounded-lg border border-bd/40 bg-surface/60 py-1.5 pl-3 pr-8 text-[13px] font-medium text-fg hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
        value={ativaSlug}
        disabled={pending}
        onChange={(e) => trocar(e.target.value)}
      >
        {empresas.map((e) => (
          <option key={e.slug} value={e.slug} className="bg-surface">
            {e.nome}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted/60"
      >
        ▾
      </span>
    </div>
  );
}
