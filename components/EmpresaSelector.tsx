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
      <div className="text-sm text-ink/60">
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
    <div className="flex items-center gap-2">
      <label className="text-xs uppercase tracking-wide text-ink/50">
        Empresa
      </label>
      <select
        className="rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 disabled:opacity-60"
        value={ativaSlug}
        disabled={pending}
        onChange={(e) => trocar(e.target.value)}
      >
        {empresas.map((e) => (
          <option key={e.slug} value={e.slug}>
            {e.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
