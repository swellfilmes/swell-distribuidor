'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  empresaId: number;
  ativo: boolean;
}

export function ToggleAtivo({ empresaId, ativo }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function alternar() {
    const novoEstado = !ativo;
    const msg = novoEstado
      ? 'Reativar essa empresa? Crons voltam a rodar pra ela.'
      : 'Desativar essa empresa? Crons param de rodar (posts agendados não publicam).';
    if (!confirm(msg)) return;

    setPending(true);
    try {
      await fetch(`/api/admin/empresas/${empresaId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ativo: novoEstado }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={alternar}
      disabled={pending}
      className={
        'rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition disabled:opacity-50 ' +
        (ativo
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100'
          : 'bg-rose-50 text-rose-800 ring-rose-200 hover:bg-rose-100')
      }
    >
      {pending ? '…' : ativo ? 'Ativa ✓ · clique p/ desativar' : 'Desativada · clique p/ reativar'}
    </button>
  );
}
