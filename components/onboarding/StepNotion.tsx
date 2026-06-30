'use client';

import { useSearchParams } from 'next/navigation';

interface Props {
  empresaId: number;
  notionPronto: boolean;
  notionDbId: string;
  onAvancar: () => void;
}

export function StepNotion({ empresaId, notionPronto, notionDbId, onAvancar }: Props) {
  const sp = useSearchParams();
  const recemConectado = sp.get('notion') === 'conectado';
  const workspaceNome = sp.get('workspace') ?? '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold leading-tight">Conectar Notion</h2>
        <p className="mt-2 text-sm text-fg-muted/70">
          Vamos criar uma database na sua workspace pra você aprovar/editar os
          posts antes deles irem pras redes. Tudo automático via OAuth.
        </p>
      </div>

      {notionPronto ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
            <span className="text-base">✓</span> Notion conectado
          </div>
          {recemConectado && workspaceNome && (
            <div className="mt-1 text-xs text-emerald-800/80">
              Workspace: <b>{workspaceNome}</b>
            </div>
          )}
          <div className="mt-2 break-all font-mono text-[11px] text-emerald-800/65">
            DB: {notionDbId}
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-bd/10 bg-surface p-5">
          <div>
            <div className="mb-2 text-sm font-medium">O que vai acontecer:</div>
            <ol className="space-y-1.5 text-xs text-fg-muted/70">
              <li>1. Clica no botão abaixo</li>
              <li>2. Notion abre um popup pedindo qual página compartilhar</li>
              <li>
                3. Você escolhe uma página vazia (cria antes: <em>"Distribuição
                Swell"</em> ou nome que quiser)
              </li>
              <li>4. Volta aqui e a database aparece sozinha lá no Notion</li>
            </ol>
          </div>

          <a
            href={`/api/notion/oauth/start?empresaId=${empresaId}`}
            className="block w-full rounded-md bg-primary px-4 py-3 text-center text-sm font-medium text-app hover:opacity-90"
          >
            🔌 Conectar Notion via OAuth
          </a>

          <div className="text-[11px] text-fg-muted/45">
            Não tem conta Notion? Cria grátis em{' '}
            <a
              href="https://notion.so"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              notion.so
            </a>{' '}
            antes de continuar.
          </div>
        </div>
      )}

      {notionPronto && (
        <button
          onClick={onAvancar}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-app hover:opacity-90"
        >
          Próximo: conectar Zernio →
        </button>
      )}
    </div>
  );
}
