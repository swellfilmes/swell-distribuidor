'use client';

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: Props) {
  useEffect(() => {
    // Log no console do browser pra você abrir DevTools e ver o erro real.
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-lg border border-rose-200 bg-rose-50 p-6">
      <div className="text-base font-semibold text-rose-900">
        Algo deu errado nessa página
      </div>
      <p className="text-sm text-rose-800/85">
        {error.message || 'Erro desconhecido — verifique sua conexão e tente de novo.'}
      </p>
      {error.digest && (
        <div className="font-mono text-[11px] text-rose-700/65">
          ref: {error.digest}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button
          onClick={reset}
          className="rounded-md bg-rose-900 px-3 py-2 text-xs font-medium text-white hover:bg-rose-800"
        >
          Tentar de novo
        </button>
        <a
          href="/app"
          className="rounded-md border border-rose-300 px-3 py-2 text-xs font-medium text-rose-900 hover:bg-rose-100"
        >
          Voltar pro painel
        </a>
      </div>
    </div>
  );
}
