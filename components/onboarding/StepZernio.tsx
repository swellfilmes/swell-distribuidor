'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Props {
  empresaId: number;
  zernioPronto: boolean;
  zernioYoutubeAccountId: string | null;
  zernioInstagramAccountId: string | null;
  zernioTiktokAccountId: string | null;
  zernioLinkedinAccountId: string | null;
  onAvancar: () => void;
}

type Rede = 'instagram' | 'youtube' | 'tiktok' | 'linkedin';
const REDES: Rede[] = ['instagram', 'youtube', 'tiktok', 'linkedin'];

interface RedeCfg {
  nome: string;
  cor: string;
  gradient: string;
}

const LABELS: Record<Rede, RedeCfg> = {
  instagram: {
    nome: 'Instagram',
    cor: '#E1306C',
    gradient: 'from-[#FF6F61] via-[#E1306C] to-[#9B30B5]',
  },
  youtube: {
    nome: 'YouTube',
    cor: '#FF0000',
    gradient: 'from-[#FF3D3D] to-[#CC0000]',
  },
  tiktok: {
    nome: 'TikTok',
    cor: '#111827',
    gradient: 'from-[#1F2937] to-[#0B0F19]',
  },
  linkedin: {
    nome: 'LinkedIn',
    cor: '#0A66C2',
    gradient: 'from-[#1877F2] to-[#0A66C2]',
  },
};

interface ContaConectada {
  id: string;
  username?: string;
  displayName?: string;
}

export function StepZernio({
  empresaId,
  zernioYoutubeAccountId,
  zernioInstagramAccountId,
  zernioTiktokAccountId,
  zernioLinkedinAccountId,
  onAvancar,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const recemConectou = sp.get('zernio') === 'conectou';
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [links, setLinks] = useState<Array<{ rede: Rede; authUrl: string; erro?: string }>>([]);
  const [contas, setContas] = useState<Partial<Record<Rede, ContaConectada>>>(() => {
    const c: Partial<Record<Rede, ContaConectada>> = {};
    if (zernioInstagramAccountId) c.instagram = { id: zernioInstagramAccountId };
    if (zernioYoutubeAccountId) c.youtube = { id: zernioYoutubeAccountId };
    if (zernioTiktokAccountId) c.tiktok = { id: zernioTiktokAccountId };
    if (zernioLinkedinAccountId) c.linkedin = { id: zernioLinkedinAccountId };
    return c;
  });

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sincronizar = useCallback(async () => {
    try {
      const r = await fetch(`/api/empresas/${empresaId}/zernio-profile`, { cache: 'no-store' });
      const d = (await r.json()) as { contas?: Record<Rede, ContaConectada>; error?: string };
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      const novasContas = d.contas ?? {};
      setContas((anteriores) => {
        const antes = Object.keys(anteriores).length;
        const agora = Object.keys(novasContas).length;
        // Quando a contagem muda, força re-render do layout (server) pra o
        // banner "ainda precisa conectar Zernio" sumir.
        if (agora !== antes) router.refresh();
        return novasContas;
      });
    } catch (err) {
      console.warn('[zernio-profile sync]', err);
    }
  }, [empresaId, router]);

  const inicializar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/empresas/${empresaId}/zernio-profile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const d = (await r.json()) as {
        profileId?: string;
        links?: Array<{ rede: Rede; authUrl: string; erro?: string }>;
        error?: string;
      };
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setLinks(d.links ?? []);
      await sincronizar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setCarregando(false);
    }
  }, [empresaId, sincronizar]);

  useEffect(() => {
    void inicializar();
  }, [inicializar]);

  // Quando volta do popup OAuth do Zernio (?zernio=conectou), faz polling
  // intenso por 30s pra ver a nova conta aparecer rápido.
  useEffect(() => {
    if (!recemConectou) return;
    void sincronizar();
    let count = 0;
    pollingRef.current = setInterval(async () => {
      count++;
      await sincronizar();
      if (count >= 10) {
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    }, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [recemConectou, sincronizar]);

  const conectadasCount = Object.keys(contas).length;
  const podeAvancar = conectadasCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold leading-tight">Conecte suas redes sociais</h2>
        <p className="mt-2 text-sm text-fg-muted">
          Clica em cada rede que você quer usar pra publicar. Vai abrir a tela
          oficial da rede pra você autorizar — depois volta sozinho pra cá.
        </p>
      </div>

      {conectadasCount > 0 && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          <div className="font-medium text-success">
            {conectadasCount === REDES.length
              ? 'Todas as redes conectadas — onboarding completo'
              : `${conectadasCount} ${conectadasCount === 1 ? 'rede conectada' : 'redes conectadas'} — onboarding completo`}
          </div>
          <div className="mt-1 text-xs text-fg-muted">
            Você já pode publicar. Conecte mais redes agora ou depois em
            Configurações.
          </div>
        </div>
      )}

      {erro && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="rounded-xl border border-bd/40 bg-surface/60 p-6 text-center text-sm text-fg-muted">
          Preparando seu cadastro no Zernio...
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {REDES.map((rede) => {
            const conta = contas[rede];
            const link = links.find((l) => l.rede === rede);
            const conectada = Boolean(conta);
            const cfg = LABELS[rede];

            return (
              <div
                key={rede}
                className={[
                  'overflow-hidden rounded-xl border transition-colors',
                  conectada ? 'border-success/40 bg-surface/60' : 'border-bd/40 bg-surface/40',
                ].join(' ')}
              >
                <div className={`bg-gradient-to-r ${cfg.gradient} px-4 py-3 text-white`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-medium">{cfg.nome}</span>
                    {conectada && (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">
                        conectado
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  {conectada ? (
                    <div className="space-y-1">
                      <div className="text-[13px] text-fg">
                        @{conta?.username ?? conta?.displayName ?? 'conta'}
                      </div>
                      <div className="font-mono text-[10px] text-fg-muted">
                        id: {conta?.id}
                      </div>
                    </div>
                  ) : link?.authUrl ? (
                    <a
                      href={link.authUrl}
                      className={`block rounded-lg bg-gradient-to-r ${cfg.gradient} px-3 py-2.5 text-center text-sm font-medium text-white hover:opacity-90`}
                    >
                      Conectar →
                    </a>
                  ) : (
                    <div className="text-xs text-error">
                      {link?.erro ?? 'Link não gerado.'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <details className="rounded-md border border-bd/40 bg-surface/40 px-3 py-2 text-xs text-fg-muted">
        <summary className="cursor-pointer">Como funciona</summary>
        <p className="mt-2">
          Cada rede que você conectar fica isolada da sua "conta" — usamos um
          sistema chamado Profile do Zernio pra separar suas redes de outros
          testadores. Você pode conectar só algumas agora e adicionar as
          outras depois pelas Configurações.
        </p>
      </details>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => void sincronizar()}
          disabled={carregando}
          className="flex-1 rounded-lg border border-bd/40 px-4 py-3 text-sm font-medium text-fg hover:bg-surface-2/60 disabled:opacity-40"
        >
          Atualizar status
        </button>
        {podeAvancar && (
          <button
            onClick={onAvancar}
            className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-app hover:opacity-90"
          >
            Próximo: pronto! →
          </button>
        )}
      </div>
    </div>
  );
}
