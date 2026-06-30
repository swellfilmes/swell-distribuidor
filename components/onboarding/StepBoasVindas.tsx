'use client';

interface Props {
  empresaNome: string;
  empresaSlug: string;
  onAvancar: () => void;
}

export function StepBoasVindas({ empresaNome, empresaSlug, onAvancar }: Props) {
  return (
    <div className="space-y-7">
      <div>
        <h2 className="font-serif text-3xl leading-tight text-fg">
          Bem-vindo ao Swell Mermaid
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          Vamos configurar a empresa{' '}
          <b className="text-fg">{empresaNome}</b>{' '}
          <span className="text-fg-muted/60">({empresaSlug})</span>{' '}
          em 3 passos rápidos. Estimativa: 5-10 minutos.
        </p>
      </div>

      <ol className="space-y-2.5">
        {[
          {
            n: '01',
            titulo: 'Conectar Notion',
            desc: 'Criamos uma database de aprovação no seu workspace via OAuth.',
            tempo: '1 clique',
          },
          {
            n: '02',
            titulo: 'Conectar suas redes',
            desc: 'Cada rede que você quiser usar — Instagram, YouTube, TikTok, LinkedIn — abre o OAuth oficial pra autorizar.',
            tempo: '~1 min por rede',
          },
          {
            n: '03',
            titulo: 'Pronto pra publicar',
            desc: 'Sobe um vídeo ou foto, aprova no Notion, e o sistema publica em todas as redes que você conectou.',
            tempo: '',
          },
        ].map((p) => (
          <li
            key={p.n}
            className="flex gap-4 rounded-xl border border-bd/40 bg-surface/40 px-4 py-3.5"
          >
            <span className="font-mono text-[11px] tracking-wider text-primary">{p.n}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-fg">{p.titulo}</div>
              <div className="mt-0.5 text-[13px] text-fg-muted">{p.desc}</div>
            </div>
            {p.tempo && (
              <span className="shrink-0 self-start rounded-full bg-bd/40 px-2 py-0.5 text-[10px] font-medium text-fg-muted">
                {p.tempo}
              </span>
            )}
          </li>
        ))}
      </ol>

      <button
        onClick={onAvancar}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-app transition-opacity hover:opacity-90"
      >
        Vamos começar →
      </button>
    </div>
  );
}
