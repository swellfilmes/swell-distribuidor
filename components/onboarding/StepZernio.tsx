'use client';

import { ZernioEditor } from '../ZernioEditor';

interface Props {
  empresaId: number;
  zernioPronto: boolean;
  zernioYoutubeAccountId: string | null;
  zernioInstagramAccountId: string | null;
  zernioTiktokAccountId: string | null;
  zernioLinkedinAccountId: string | null;
  onAvancar: () => void;
}

export function StepZernio({
  empresaId,
  zernioPronto,
  zernioYoutubeAccountId,
  zernioInstagramAccountId,
  zernioTiktokAccountId,
  zernioLinkedinAccountId,
  onAvancar,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold leading-tight">Conectar Zernio</h2>
        <p className="mt-2 text-sm text-ink/70">
          Zernio é o serviço que publica nas redes sociais por trás dos panos.
          Você precisa criar uma conta lá, conectar suas redes, e colar a API key
          + IDs de cada rede aqui.
        </p>
      </div>

      <ZernioEditor
        empresaId={empresaId}
        zernioPronto={zernioPronto}
        zernioYoutubeAccountId={zernioYoutubeAccountId}
        zernioInstagramAccountId={zernioInstagramAccountId}
        zernioTiktokAccountId={zernioTiktokAccountId}
        zernioLinkedinAccountId={zernioLinkedinAccountId}
        mostrarInstrucoes
      />

      {zernioPronto && (
        <button
          onClick={onAvancar}
          className="w-full rounded-md bg-ink px-4 py-3 text-sm font-medium text-cream hover:opacity-90"
        >
          Próximo: pronto! →
        </button>
      )}
    </div>
  );
}
