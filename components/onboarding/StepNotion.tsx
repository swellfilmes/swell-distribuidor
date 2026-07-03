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
        <div className="rounded-xl border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <span className="text-base">✓</span> Notion conectado
          </div>
          {recemConectado && workspaceNome && (
            <div className="mt-1 text-xs text-success/80">
              Workspace: <b>{workspaceNome}</b>
            </div>
          )}
          <div className="mt-2 break-all font-mono text-[11px] text-success/65">
            DB: {notionDbId}
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-bd/10 bg-surface p-5">
          <div>
            <div className="mb-2 text-sm font-medium">Antes de começar:</div>
            <ol className="space-y-1.5 text-xs text-fg-muted/70">
              <li>
                1. <b className="text-fg">Abre o Notion em outra aba</b> e cria
                uma página vazia (pode chamar de "Swell Mermaid", "Marketing" ou
                qualquer nome). Se já tiver uma página tipo "Conteúdo", pode usar essa.
              </li>
              <li>2. Volta aqui e clica no botão abaixo</li>
              <li>
                3. O Notion vai abrir um popup mostrando as permissões → clica em{' '}
                <span className="inline-block rounded bg-fg-muted/15 px-1.5 py-0.5 font-medium text-fg">
                  Selecionar páginas
                </span>
              </li>
              <li>
                4. Marca a página que você criou no passo 1 → clica em{' '}
                <span className="inline-block rounded bg-fg-muted/15 px-1.5 py-0.5 font-medium text-fg">
                  Permitir acesso
                </span>
              </li>
              <li>
                5. Volta pra cá — a gente cria a database{' '}
                <b className="text-fg">automaticamente</b> dentro da página escolhida
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-primary/25 bg-primary/[0.05] p-3 text-[11px] text-fg-muted">
            💡 A database dos posts vai virar uma sub-página dentro da página
            que você escolher. Você pode mover ela pra outro lugar depois se quiser.
          </div>

          <a
            href={`/api/notion/oauth/start?empresaId=${empresaId}`}
            className="block w-full rounded-md bg-primary px-4 py-3 text-center text-sm font-medium text-app hover:opacity-90"
          >
            Conectar Notion
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
