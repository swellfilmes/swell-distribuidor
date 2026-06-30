'use client';

import Link from 'next/link';

interface Props {
  empresaNome: string;
  empresaSlug: string;
}

export function StepPronto({ empresaNome, empresaSlug }: Props) {
  return (
    <div className="space-y-7 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <div>
        <h2 className="font-serif text-3xl leading-tight text-fg">
          {empresaNome} pronta pra publicar
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          Notion e redes conectados. Agora você pode subir mídia, ver a IA gerar
          as legendas, aprovar no Notion e publicar nas redes.
        </p>
      </div>

      <div className="space-y-2 text-left">
        <CartaoAcao
          href={`/app/upload?empresa=${empresaSlug}`}
          titulo="Subir primeira mídia"
          desc="Arrasta um vídeo, foto ou carrossel. A IA classifica e gera as legendas em ~30s."
        />
        <CartaoAcao
          href={`/app/posts?empresa=${empresaSlug}`}
          titulo="Ver posts agendados"
          desc="Calendário das publicações futuras e histórico do que já saiu."
        />
        <CartaoAcao
          href={`/app/configuracoes?empresa=${empresaSlug}`}
          titulo="Configurações"
          desc="Adicionar mais redes sociais, editar integrações, ver perfil."
        />
      </div>
    </div>
  );
}

function CartaoAcao({
  href,
  titulo,
  desc,
}: {
  href: string;
  titulo: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border border-bd/40 bg-surface/40 p-4 transition-colors hover:border-bd/70 hover:bg-surface-2/60"
    >
      <div className="flex-1">
        <div className="text-[14px] font-medium text-fg">{titulo}</div>
        <div className="mt-0.5 text-xs text-fg-muted">{desc}</div>
      </div>
      <span className="self-center text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary">
        →
      </span>
    </Link>
  );
}
