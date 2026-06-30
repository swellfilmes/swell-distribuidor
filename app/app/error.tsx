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
    <div className="mx-auto max-w-2xl space-y-4 rounded-lg border border-error/30 bg-error/10 p-6">
      <div className="text-base font-semibold text-error">
        Algo deu errado nessa página
      </div>
      <p className="text-sm text-error/85">
        {error.message || 'Erro desconhecido — verifique sua conexão e tente de novo.'}
      </p>
      {error.digest && (
        <div className="font-mono text-[11px] text-error/65">
          ref: {error.digest}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button
          onClick={reset}
          className="rounded-md bg-error px-3 py-2 text-xs font-medium text-white hover:bg-error/90"
        >
          Tentar de novo
        </button>
        <a
          href="/app"
          className="rounded-md border border-error/30 px-3 py-2 text-xs font-medium text-error hover:bg-error/15"
        >
          Voltar pro painel
        </a>
      </div>
    </div>
  );
}
