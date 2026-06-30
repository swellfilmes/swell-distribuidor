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
  const label = jaConectado ? 'Reconectar Notion' : 'Conectar Notion';

  return (
    <div className="space-y-3 rounded-xl border border-bd/40 bg-surface/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-fg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M8 7v10" />
              <path d="m8 7 8 10" />
              <path d="M16 7v10" />
            </svg>
          </span>
          <div>
            <div className="text-[14px] font-medium text-fg">
              {jaConectado ? 'Notion conectado' : 'Conectar Notion'}
            </div>
            <div className="text-[12px] text-fg-muted">
              {jaConectado
                ? 'Sua database de aprovação está pronta no seu workspace.'
                : 'OAuth oficial. Criamos a database de aprovação automaticamente.'}
            </div>
          </div>
        </div>
        <a
          href={href}
          className={[
            'shrink-0 rounded-lg px-3 py-2 text-center text-xs font-medium transition-opacity',
            jaConectado
              ? 'border border-bd/40 text-fg hover:bg-surface-2/60'
              : 'bg-primary text-app hover:opacity-90',
          ].join(' ')}
        >
          {label}
        </a>
      </div>

      {jaConectado && (
        <div className="border-t border-bd/40 pt-2 text-[11px] text-fg-muted">
          database id: <code className="break-all text-fg-muted/85">{dbId}</code>
        </div>
      )}

      {recemConectado && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-[12px] text-success">
          Notion conectado{workspaceNome ? ` (workspace: ${workspaceNome})` : ''}.
        </div>
      )}
    </div>
  );
}
