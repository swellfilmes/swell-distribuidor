'use client';

import Link from 'next/link';

interface Props {
  empresaNome: string;
  empresaSlug: string;
}

export function StepPronto({ empresaNome, empresaSlug }: Props) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
        🎉
      </div>
      <div>
        <h2 className="text-2xl font-semibold leading-tight">
          {empresaNome} pronta pra publicar
        </h2>
        <p className="mt-2 text-sm text-ink/70">
          Notion e Zernio conectados. Agora você pode subir vídeos, ver a IA
          gerar as legendas, aprovar no Notion e publicar.
        </p>
      </div>

      <div className="space-y-2 text-left">
        <Link
          href={`/app/upload?empresa=${empresaSlug}`}
          className="block rounded-lg border border-ink/10 bg-white p-4 hover:bg-ink/[0.02]"
        >
          <div className="font-medium">📤 Subir primeiro vídeo</div>
          <div className="mt-1 text-xs text-ink/55">
            Arrasta um .mp4, a IA classifica e gera as legendas em ~30s.
          </div>
        </Link>
        <Link
          href={`/app/posts?empresa=${empresaSlug}`}
          className="block rounded-lg border border-ink/10 bg-white p-4 hover:bg-ink/[0.02]"
        >
          <div className="font-medium">📋 Ver posts agendados</div>
          <div className="mt-1 text-xs text-ink/55">
            Calendário das publicações futuras e histórico.
          </div>
        </Link>
        <Link
          href={`/app/configuracoes?empresa=${empresaSlug}`}
          className="block rounded-lg border border-ink/10 bg-white p-4 hover:bg-ink/[0.02]"
        >
          <div className="font-medium">⚙️ Configurações da empresa</div>
          <div className="mt-1 text-xs text-ink/55">
            Editar nome, atualizar integrações, gerenciar membros.
          </div>
        </Link>
      </div>
    </div>
  );
}
