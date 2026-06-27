'use client';

import { useSearchParams } from 'next/navigation';

interface Props {
  empresaId: number;
  jaConectado: boolean;
  dbId: string;
}

export function NotionConnectButton({ empresaId, jaConectado, dbId }: Props) {
  const sp = useSearchParams();
  const recemConectado = sp.get('notion') === 'conectado';
  const workspaceNome = sp.get('workspace') ?? '';

  const href = `/api/notion/oauth/start?empresaId=${empresaId}`;
  const label = jaConectado ? 'Reconectar Notion (OAuth)' : 'Conectar Notion (OAuth)';

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Notion via OAuth</div>
          <div className="text-xs text-ink/55">
            Autoriza o app e cria a database de distribuição automaticamente na sua workspace.
          </div>
        </div>
        <a
          href={href}
          className="rounded-md bg-ink px-3 py-2 text-xs font-medium text-white hover:bg-ink/85"
        >
          {label}
        </a>
      </div>

      {jaConectado && (
        <div className="mt-2 text-xs text-ink/55">
          DB atual: <code className="break-all">{dbId}</code>
        </div>
      )}

      {recemConectado && (
        <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          ✅ Notion conectado{workspaceNome ? ` (workspace: ${workspaceNome})` : ''}. A database
          já foi criada na sua workspace e os campos abaixo foram atualizados.
        </div>
      )}
    </div>
  );
}
