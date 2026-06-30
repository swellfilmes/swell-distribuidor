'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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

const LABELS: Record<Rede, { nome: string; cor: string; icon: string }> = {
  instagram: { nome: 'Instagram', cor: 'from-pink-500 to-purple-600', icon: '📷' },
  youtube: { nome: 'YouTube', cor: 'from-red-500 to-red-700', icon: '▶️' },
  tiktok: { nome: 'TikTok', cor: 'from-gray-900 to-gray-700', icon: '🎵' },
  linkedin: { nome: 'LinkedIn', cor: 'from-blue-600 to-blue-800', icon: '💼' },
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
      setContas(d.contas ?? {});
    } catch (err) {
      // Silencioso — polling é "best effort", erro detalhado já apareceu no POST.
      console.warn('[zernio-profile sync]', err);
    }
  }, [empresaId]);

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
        <p className="mt-2 text-sm text-ink/70">
          Clica em cada rede que você quer usar pra publicar. Vai abrir a tela
          oficial da rede pra você autorizar — depois volta sozinho pra cá.
        </p>
      </div>

      {recemConectou && conectadasCount > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <div className="font-medium text-emerald-900">
            ✓ {conectadasCount} {conectadasCount === 1 ? 'rede conectada' : 'redes conectadas'}
          </div>
          <div className="mt-1 text-xs text-emerald-800/80">
            Pode conectar mais ou avançar pro próximo passo.
          </div>
        </div>
      )}

      {erro && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-900">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="rounded-xl border border-ink/10 bg-white p-6 text-center text-sm text-ink/55">
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
                  'overflow-hidden rounded-xl border bg-white',
                  conectada ? 'border-emerald-300' : 'border-ink/15',
                ].join(' ')}
              >
                <div className={`bg-gradient-to-r ${cfg.cor} px-4 py-3 text-white`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cfg.icon}</span>
                      <span className="font-medium">{cfg.nome}</span>
                    </div>
                    {conectada && (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">
                        ✓ conectado
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  {conectada ? (
                    <div className="space-y-1">
                      <div className="text-xs text-ink/70">
                        @{conta?.username ?? conta?.displayName ?? 'conta'}
                      </div>
                      <div className="font-mono text-[10px] text-ink/40">
                        id: {conta?.id}
                      </div>
                    </div>
                  ) : link?.authUrl ? (
                    <a
                      href={link.authUrl}
                      className={`block rounded-md bg-gradient-to-r ${cfg.cor} px-3 py-2.5 text-center text-sm font-medium text-white hover:opacity-90`}
                    >
                      Conectar →
                    </a>
                  ) : (
                    <div className="text-xs text-red-700">
                      {link?.erro ?? 'Link não gerado.'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <details className="rounded-md border border-ink/10 bg-ink/[0.02] px-3 py-2 text-xs text-ink/65">
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
          className="flex-1 rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5 disabled:opacity-40"
        >
          Atualizar status
        </button>
        {podeAvancar && (
          <button
            onClick={onAvancar}
            className="flex-1 rounded-md bg-ink px-4 py-3 text-sm font-medium text-cream hover:opacity-90"
          >
            Próximo: pronto! →
          </button>
        )}
      </div>
    </div>
  );
}
