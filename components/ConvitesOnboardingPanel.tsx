'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Convite {
  id: number;
  token: string;
  emailSugerido: string | null;
  nomeEmpresaSugerido: string | null;
  consumidoEm: Date | string | null;
  empresaCriadaId: number | null;
  empresaCriadaNome: string | null;
  criadoEm: Date | string;
}

interface Props {
  inicial: Convite[];
}

function formatarData(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function ConvitesOnboardingPanel({ inicial }: Props) {
  const router = useRouter();
  const [convites, setConvites] = useState<Convite[]>(inicial);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [emailSugerido, setEmailSugerido] = useState('');
  const [nomeEmpresaSugerido, setNomeEmpresaSugerido] = useState('');
  const [copiadoId, setCopiadoId] = useState<number | null>(null);

  function urlConvite(token: string): string {
    if (typeof window === 'undefined') return `/convite/${token}`;
    return `${window.location.origin}/convite/${token}`;
  }

  async function criar() {
    setCriando(true);
    setErro(null);
    try {
      const resp = await fetch('/api/admin/convites-onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          emailSugerido: emailSugerido || undefined,
          nomeEmpresaSugerido: nomeEmpresaSugerido || undefined,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        id?: number;
        token?: string;
        error?: string;
      };
      if (!resp.ok || !data.token) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      setEmailSugerido('');
      setNomeEmpresaSugerido('');
      router.refresh();
      // Optimistic: adiciona no topo
      setConvites((c) => [
        {
          id: data.id!,
          token: data.token!,
          emailSugerido: null,
          nomeEmpresaSugerido: null,
          consumidoEm: null,
          empresaCriadaId: null,
          empresaCriadaNome: null,
          criadoEm: new Date(),
        },
        ...c,
      ]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setCriando(false);
    }
  }

  async function cancelar(id: number) {
    if (!confirm('Cancelar este convite? Quem tem o link não vai mais conseguir usar.')) return;
    const resp = await fetch(`/api/admin/convites-onboarding/${id}`, { method: 'DELETE' });
    if (resp.ok) {
      setConvites((c) => c.filter((x) => x.id !== id));
      router.refresh();
    }
  }

  function copiar(c: Convite) {
    const url = urlConvite(c.token);
    navigator.clipboard.writeText(url).then(() => {
      setCopiadoId(c.id);
      setTimeout(() => setCopiadoId((cur) => (cur === c.id ? null : cur)), 1500);
    });
  }

  const pendentes = convites.filter((c) => !c.consumidoEm);
  const usados = convites.filter((c) => c.consumidoEm);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-bd/40 bg-surface/40 p-5">
        <div className="mb-3 text-[13px] font-medium text-fg">Gerar novo convite</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="email"
            value={emailSugerido}
            onChange={(e) => setEmailSugerido(e.target.value)}
            placeholder="Email sugerido (opcional)"
            className="rounded-lg border border-bd/40 bg-surface-2/60 px-3 py-2 text-sm text-fg placeholder:text-fg-muted/50 focus:border-primary/60 focus:bg-surface-2 focus:outline-none"
          />
          <input
            type="text"
            value={nomeEmpresaSugerido}
            onChange={(e) => setNomeEmpresaSugerido(e.target.value)}
            placeholder="Nome de empresa sugerido (opcional)"
            className="rounded-lg border border-bd/40 bg-surface-2/60 px-3 py-2 text-sm text-fg placeholder:text-fg-muted/50 focus:border-primary/60 focus:bg-surface-2 focus:outline-none"
          />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] text-fg-muted">
            Campos opcionais — só dicas pré-preenchidas pro convidado.
          </p>
          <button
            onClick={criar}
            disabled={criando}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-app transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {criando ? 'Gerando...' : 'Gerar link'}
          </button>
        </div>
        {erro && (
          <div className="mt-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
            {erro}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-fg-muted">
          Pendentes ({pendentes.length})
        </div>
        {pendentes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-bd/40 p-5 text-center text-xs text-fg-muted">
            Nenhum convite pendente.
          </div>
        ) : (
          <div className="space-y-2">
            {pendentes.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-xl border border-bd/40 bg-surface/40 p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs text-fg">
                    {urlConvite(c.token)}
                  </div>
                  <div className="mt-1 text-[11px] text-fg-muted">
                    Criado {formatarData(c.criadoEm)}
                    {c.emailSugerido && ` · pra ${c.emailSugerido}`}
                    {c.nomeEmpresaSugerido && ` · empresa "${c.nomeEmpresaSugerido}"`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copiar(c)}
                    className="rounded-lg border border-bd/40 px-3 py-1.5 text-xs text-fg transition-colors hover:bg-surface-2/60"
                  >
                    {copiadoId === c.id ? 'Copiado!' : 'Copiar link'}
                  </button>
                  <button
                    onClick={() => cancelar(c.id)}
                    className="rounded-lg border border-error/30 px-3 py-1.5 text-xs text-error transition-colors hover:bg-error/10"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {usados.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.15em] text-fg-muted">
            Já consumidos ({usados.length})
          </summary>
          <div className="mt-3 space-y-2">
            {usados.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-bd/40 bg-surface/30 p-3 text-xs"
              >
                <div className="text-fg">
                  Virou empresa{' '}
                  <b className="text-primary">{c.empresaCriadaNome ?? `#${c.empresaCriadaId}`}</b>
                </div>
                <div className="mt-0.5 text-[11px] text-fg-muted">
                  Consumido em {c.consumidoEm ? formatarData(c.consumidoEm) : '?'}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
