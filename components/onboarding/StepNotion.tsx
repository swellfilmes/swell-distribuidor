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
            <div className="mb-2 text-sm font-medium">O que vai acontecer:</div>
            <ol className="space-y-1.5 text-xs text-fg-muted/70">
              <li>1. Clica no botão abaixo</li>
              <li>
                2. O Notion vai abrir um popup pedindo pra você{' '}
                <b className="text-fg">selecionar as páginas</b> que essa integração pode acessar
              </li>
              <li>
                3. <b className="text-fg">Não precisa criar página antes</b> — no
                próprio popup do Notion, clique em{' '}
                <span className="inline-block rounded bg-fg-muted/15 px-1.5 py-0.5 font-medium text-fg">
                  + Add page
                </span>{' '}
                lá em cima pra criar uma página vazia na hora
              </li>
              <li>
                4. Confirma e volta pra cá — a gente cria a database{' '}
                <b className="text-fg">automaticamente</b> dentro da página escolhida
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-primary/25 bg-primary/[0.05] p-3 text-[11px] text-fg-muted">
            💡 Dica: se você <b className="text-fg">já</b> tem uma página tipo "Marketing" ou
            "Conteúdo" no seu workspace, dá pra selecionar ela também — a database vira uma
            sub-página lá dentro.
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
