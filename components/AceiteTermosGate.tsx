'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  /**
   * Estado inicial passado pelo Server Component que renderiza o gate.
   * Evita o flash &ldquo;mostra app por 200ms, depois esconde&rdquo;.
   * Quando undefined, faz fetch no mount (modo standalone, ex: /convite).
   */
  jaAceito?: boolean;
  /**
   * Conteúdo que vai aparecer DEPOIS que o usuário aceitar (ou se já
   * estiver aceito). O gate envolve o filho e bloqueia tela cheia
   * enquanto o aceite não foi dado.
   */
  children: React.ReactNode;
}

/**
 * Gate de aceite dos Termos + Política de Privacidade.
 *
 * Comportamento:
 * - Se `jaAceito === true`: renderiza `children` direto.
 * - Se `jaAceito === false` ou undefined: faz fetch em /api/aceitar-termos
 *   pra confirmar, e enquanto estiver pendente bloqueia tudo com um overlay
 *   de tela cheia.
 *
 * O botão &ldquo;Aceitar e continuar&rdquo; é o aceite formal — usuário só
 * pode clicar depois de marcar o checkbox que confirma ter lido os documentos.
 * Os links &ldquo;Termos&rdquo; e &ldquo;Política&rdquo; abrem em nova aba
 * pra não tirar o contexto.
 *
 * Não bloqueia tela em caso de erro de rede no GET — assume pessimista
 * (mostra o modal de aceite) e deixa a tentativa no botão. Se o POST falhar
 * por usuário ainda não sincronizado (409), mostra mensagem específica.
 */
export function AceiteTermosGate({ jaAceito, children }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<'verificando' | 'aceito' | 'pendente'>(
    jaAceito === true ? 'aceito' : jaAceito === false ? 'pendente' : 'verificando',
  );
  const [conferido, setConferido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Quando o pai não conseguiu (ou não quis) passar o estado inicial,
  // fazemos o fetch no client. Caso aconteça erro, mostramos a tela
  // pendente — pessimista por desenho.
  useEffect(() => {
    if (estado !== 'verificando') return;
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch('/api/aceitar-termos', { cache: 'no-store' });
        const data = (await r.json().catch(() => ({}))) as {
          aceito?: boolean;
        };
        if (cancelado) return;
        setEstado(data.aceito ? 'aceito' : 'pendente');
      } catch {
        if (cancelado) return;
        setEstado('pendente');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [estado]);

  async function aceitar() {
    if (!conferido) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch('/api/aceitar-termos', { method: 'POST' });
      const data = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!r.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${r.status}`);
      }
      setEstado('aceito');
      // Refresh dos server components — assim o syncUsuarioAtual do layout
      // próximo render já reflete o aceite (não vai mostrar gate de novo).
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setEnviando(false);
    }
  }

  if (estado === 'aceito') {
    return <>{children}</>;
  }

  // Estado 'verificando' OU 'pendente': bloqueia com overlay.
  // 'verificando' mostra um skeleton silencioso pra evitar piscada;
  // 'pendente' mostra o modal real.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="aceite-titulo"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-app/95 px-4 py-8 backdrop-blur-sm"
    >
      {estado === 'verificando' ? (
        <div className="text-[13px] text-fg-muted">Carregando…</div>
      ) : (
        <div className="w-full max-w-lg space-y-6 rounded-2xl border border-bd/40 bg-surface/80 p-6 sm:p-8">
          <header className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-fg-muted">
              Swell Mermaid
            </div>
            <h2
              id="aceite-titulo"
              className="font-serif text-[24px] leading-tight text-fg"
            >
              Antes de continuar
            </h2>
            <p className="text-[14px] text-fg-muted">
              Pra usar o Swell Mermaid você precisa concordar com os Termos
              de Uso e com a Política de Privacidade (LGPD). Leve um minuto
              pra ler — abrimos em uma nova aba.
            </p>
          </header>

          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="/termos"
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-lg border border-bd/40 px-4 py-2.5 text-center text-[13px] font-medium text-fg hover:bg-surface-2/60"
            >
              Termos de Uso ↗
            </a>
            <a
              href="/privacidade"
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-lg border border-bd/40 px-4 py-2.5 text-center text-[13px] font-medium text-fg hover:bg-surface-2/60"
            >
              Política de Privacidade ↗
            </a>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-bd/40 bg-surface-2/40 p-4 text-[13.5px] leading-relaxed text-fg/90 hover:bg-surface-2/60">
            <input
              type="checkbox"
              checked={conferido}
              onChange={(e) => setConferido(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
              aria-describedby="aceite-descricao"
            />
            <span id="aceite-descricao">
              Li e aceito os <strong>Termos de Uso</strong> e a{' '}
              <strong>Política de Privacidade</strong> do Swell Mermaid
              (versão v1, 30/06/2026), incluindo o tratamento de dados
              pessoais sob a LGPD descrito nesses documentos.
            </span>
          </label>

          {erro && (
            <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-[12px] text-error">
              {erro}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={aceitar}
              disabled={!conferido || enviando}
              className="rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-medium text-app hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {enviando ? 'Salvando…' : 'Aceitar e continuar'}
            </button>
          </div>

          <p className="text-center text-[11px] text-fg-muted">
            Se você não concorda, basta fechar essa aba — sua conta
            permanece criada mas inativa, e você pode pedir exclusão a
            qualquer momento pelo e-mail filmesswell@gmail.com.
          </p>
        </div>
      )}
    </div>
  );
}
