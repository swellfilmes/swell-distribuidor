'use client';

interface Props {
  empresaNome: string;
  empresaSlug: string;
  onAvancar: () => void;
}

export function StepBoasVindas({ empresaNome, empresaSlug, onAvancar }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold leading-tight">
          Bem-vindo(a) ao Swell Distribuidor 👋
        </h2>
        <p className="mt-2 text-sm text-ink/70">
          Vamos configurar a empresa{' '}
          <b>{empresaNome}</b>{' '}
          <span className="text-ink/45">({empresaSlug})</span>{' '}
          em 3 passos rápidos. Estimativa: 15-20 minutos.
        </p>
      </div>

      <ol className="space-y-3 text-sm">
        <li className="flex gap-3 rounded-lg border border-ink/10 bg-white p-3">
          <span className="font-mono text-xs text-ink/40">1.</span>
          <div>
            <div className="font-medium">Conectar Notion (1 clique)</div>
            <div className="text-ink/55">
              Vamos criar uma database de aprovação na sua workspace via OAuth.
            </div>
          </div>
        </li>
        <li className="flex gap-3 rounded-lg border border-ink/10 bg-white p-3">
          <span className="font-mono text-xs text-ink/40">2.</span>
          <div>
            <div className="font-medium">Conectar Zernio (10-15 min)</div>
            <div className="text-ink/55">
              Você cria conta no zernio.com, conecta IG/YT/TT/LI e cola a API key
              aqui. A gente te guia.
            </div>
          </div>
        </li>
        <li className="flex gap-3 rounded-lg border border-ink/10 bg-white p-3">
          <span className="font-mono text-xs text-ink/40">3.</span>
          <div>
            <div className="font-medium">Pronto pra publicar</div>
            <div className="text-ink/55">
              Sobe um vídeo, aprova no Notion, e o sistema publica em todas as
              redes.
            </div>
          </div>
        </li>
      </ol>

      <button
        onClick={onAvancar}
        className="w-full rounded-md bg-ink px-4 py-3 text-sm font-medium text-cream hover:opacity-90"
      >
        Vamos começar →
      </button>
    </div>
  );
}
