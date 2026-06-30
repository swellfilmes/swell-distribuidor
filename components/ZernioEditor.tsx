'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  empresaId: number;
  zernioPronto: boolean;
  zernioYoutubeAccountId: string | null;
  zernioInstagramAccountId: string | null;
  zernioTiktokAccountId: string | null;
  zernioLinkedinAccountId: string | null;
  /** Mostra o cabeçalho com instruções (modo wizard). Em configurações,
   * passamos false porque o usuário já conhece o fluxo. */
  mostrarInstrucoes?: boolean;
  /** Callback opcional pro pai reagir ao salvar com sucesso (ex: liberar
   * botão "Próximo" no wizard sem precisar de router.refresh). */
  onSalvouComSucesso?: () => void;
}

export function ZernioEditor({
  empresaId,
  zernioPronto,
  zernioYoutubeAccountId,
  zernioInstagramAccountId,
  zernioTiktokAccountId,
  zernioLinkedinAccountId,
  mostrarInstrucoes = true,
  onSalvouComSucesso,
}: Props) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [yt, setYt] = useState(zernioYoutubeAccountId ?? '');
  const [ig, setIg] = useState(zernioInstagramAccountId ?? '');
  const [tt, setTt] = useState(zernioTiktokAccountId ?? '');
  const [li, setLi] = useState(zernioLinkedinAccountId ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  // Estado local pra refletir conexão pronta sem esperar router.refresh propagar.
  const temAlgumaRedeAtual = Boolean(yt || ig || tt || li);
  const [prontoLocal, setProntoLocal] = useState(zernioPronto);
  const prontoEfetivo = prontoLocal || zernioPronto;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setOk(false);
    if (!apiKey && !zernioPronto) {
      setErro('Cola a API Key do Zernio antes de salvar.');
      setSalvando(false);
      return;
    }
    if (!temAlgumaRedeAtual) {
      setErro('Preencha pelo menos um Account ID (Instagram, YouTube, TikTok ou LinkedIn) — sem isso o sistema não publica em nenhuma rede.');
      setSalvando(false);
      return;
    }
    try {
      const resp = await fetch(`/api/empresas/${empresaId}/zernio`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          zernioApiKey: apiKey || undefined,
          zernioYoutubeAccountId: yt || undefined,
          zernioInstagramAccountId: ig || undefined,
          zernioTiktokAccountId: tt || undefined,
          zernioLinkedinAccountId: li || undefined,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      setOk(true);
      setApiKey('');
      setProntoLocal(true);
      onSalvouComSucesso?.();
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      {mostrarInstrucoes && (
        <details className="rounded-xl border border-bd/10 bg-surface p-4 text-sm" open>
          <summary className="cursor-pointer font-medium">
            📋 Como obter as chaves do Zernio (~10 min)
          </summary>
          <ol className="mt-3 space-y-2 text-xs text-fg-muted/70">
            <li>
              <b>1. Cria conta:</b> vai em{' '}
              <a
                href="https://zernio.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                zernio.com
              </a>{' '}
              e faz signup (gratuito até 5 posts/mês).
            </li>
            <li>
              <b>2. Conecta suas redes:</b> menu <b>Accounts → Connect</b>. Pra cada
              rede (Instagram, YouTube, TikTok, LinkedIn) você faz login na rede e
              autoriza o Zernio.
            </li>
            <li>
              <b>3. Copia a API Key:</b> menu <b>API Keys → Create</b>. Cola no
              primeiro campo abaixo.
            </li>
            <li>
              <b>4. Copia os Account IDs:</b> menu <b>Accounts</b>, copia o{' '}
              <code>_id</code> de cada conta e cola no campo correspondente.
            </li>
          </ol>
        </details>
      )}

      {prontoEfetivo && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-emerald-900">
            <span className="text-base">✓</span> Zernio já conectado
          </div>
          <div className="mt-1 text-xs text-emerald-800/80">
            Pra trocar a API Key, cola a nova abaixo. Pra manter, deixa em branco e
            só atualiza os account IDs que mudou.
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-bd/10 bg-surface p-5">
        <Campo
          label="API Key do Zernio"
          value={apiKey}
          onChange={setApiKey}
          placeholder={zernioPronto ? 'Deixa vazio pra manter' : 'sk_... ou cole aqui'}
          obrigatorio={!zernioPronto}
          mono
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Instagram account ID" value={ig} onChange={setIg} placeholder="(opcional)" mono />
          <Campo label="YouTube account ID" value={yt} onChange={setYt} placeholder="(opcional)" mono />
          <Campo label="TikTok account ID" value={tt} onChange={setTt} placeholder="(opcional)" mono />
          <Campo label="LinkedIn account ID" value={li} onChange={setLi} placeholder="(opcional)" mono />
        </div>
        <p className="text-[11px] text-fg-muted/45">
          Account IDs vazios = rede não vai ser publicada.
        </p>
      </div>

      {erro && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-900">{erro}</div>
      )}
      {ok && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          ✅ Zernio salvo.
        </div>
      )}

      <button
        onClick={salvar}
        disabled={salvando}
        className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-app hover:opacity-90 disabled:opacity-40"
      >
        {salvando ? 'Salvando...' : 'Salvar Zernio'}
      </button>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  obrigatorio,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  obrigatorio?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">
        {label}
        {obrigatorio && <span className="ml-1 text-red-600">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          'w-full rounded-md border border-bd/15 bg-surface px-3 py-2 text-sm focus:border-bd focus:outline-none',
          mono ? 'font-mono text-xs' : '',
        ].join(' ')}
      />
    </div>
  );
}
