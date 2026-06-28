'use client';

import { Suspense, useState } from 'react';
import { OnboardingProgress } from './onboarding/OnboardingProgress';
import { StepBoasVindas } from './onboarding/StepBoasVindas';
import { StepNotion } from './onboarding/StepNotion';
import { StepZernio } from './onboarding/StepZernio';
import { StepPronto } from './onboarding/StepPronto';

interface Props {
  empresaId: number;
  empresaNome: string;
  empresaSlug: string;
  notionPronto: boolean;
  notionDbId: string;
  zernioPronto: boolean;
  zernioYoutubeAccountId: string | null;
  zernioInstagramAccountId: string | null;
  zernioTiktokAccountId: string | null;
  zernioLinkedinAccountId: string | null;
}

type StepId = 'boas-vindas' | 'notion' | 'zernio' | 'pronto';

export function OnboardingWizard(props: Props) {
  // Step inicial baseado no estado real da empresa:
  // - sem Notion → notion
  // - tem Notion mas sem Zernio → zernio
  // - tem ambos → pronto
  // - usuário pode também recuar pra "boas-vindas" manualmente
  const initialStep: StepId = !props.notionPronto
    ? 'notion'
    : !props.zernioPronto
      ? 'zernio'
      : 'pronto';
  const [step, setStep] = useState<StepId>(initialStep);

  const passos = [
    { id: 'boas-vindas', label: 'Bem-vindo', completo: false, ativo: step === 'boas-vindas' },
    { id: 'notion', label: 'Notion', completo: props.notionPronto, ativo: step === 'notion' },
    { id: 'zernio', label: 'Zernio', completo: props.zernioPronto, ativo: step === 'zernio' },
    { id: 'pronto', label: 'Pronto', completo: props.notionPronto && props.zernioPronto, ativo: step === 'pronto' },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-xl bg-white/60 p-4 backdrop-blur sm:p-5">
        <OnboardingProgress passos={passos} />
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white/85 p-5 shadow-sm backdrop-blur sm:p-8">
        {step === 'boas-vindas' && (
          <StepBoasVindas
            empresaNome={props.empresaNome}
            empresaSlug={props.empresaSlug}
            onAvancar={() => setStep('notion')}
          />
        )}
        {step === 'notion' && (
          <Suspense fallback={null}>
            <StepNotion
              empresaId={props.empresaId}
              notionPronto={props.notionPronto}
              notionDbId={props.notionDbId}
              onAvancar={() => setStep('zernio')}
            />
          </Suspense>
        )}
        {step === 'zernio' && (
          <StepZernio
            empresaId={props.empresaId}
            zernioPronto={props.zernioPronto}
            zernioYoutubeAccountId={props.zernioYoutubeAccountId}
            zernioInstagramAccountId={props.zernioInstagramAccountId}
            zernioTiktokAccountId={props.zernioTiktokAccountId}
            zernioLinkedinAccountId={props.zernioLinkedinAccountId}
            onAvancar={() => setStep('pronto')}
          />
        )}
        {step === 'pronto' && (
          <StepPronto
            empresaNome={props.empresaNome}
            empresaSlug={props.empresaSlug}
          />
        )}
      </div>

      {step !== 'boas-vindas' && step !== 'pronto' && (
        <div className="flex justify-center">
          <button
            onClick={() => {
              if (step === 'notion') setStep('boas-vindas');
              else if (step === 'zernio') setStep('notion');
            }}
            className="text-xs text-ink/55 hover:underline"
          >
            ← voltar
          </button>
        </div>
      )}
    </div>
  );
}
