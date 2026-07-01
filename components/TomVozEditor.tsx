'use client';

import { useEffect, useState } from 'react';

const PLACEHOLDER = `Ex:

Personalidade
- Como se fôssemos um diretor de fotografia com 20 anos de estrada. Direto, sem clichê, sem exclamação forçada.

Como escrevemos
- Frase curta que ancore o vídeo em algo visto (ambiente, ritmo, luz).
- Nunca "produzimos com carinho" ou "foi incrível".
- Uma quebra de linha entre parágrafos.

Estrutura ideal de legenda
1. Gancho: uma afirmação que pare o scroll.
2. Desenvolvimento: 1-2 frases contando o que a peça é.
3. Fechamento: crédito da equipe ou call sutil.

Palavras frequentes
- premium, cinematográfico, ritmo, textura, luz, palco, marca.`;

interface Props {
  podeEditar: boolean;
}

export function TomVozEditor({ podeEditar }: Props) {
  const [valor, setValor] = useState('');
  const [inicial, setInicial] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const resp = await fetch('/api/empresa/tom-voz');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as { tomVoz: string | null };
        if (!vivo) return;
        const v = data.tomVoz ?? '';
        setValor(v);
        setInicial(v);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const sujo = valor !== inicial;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setOkMsg(null);
    try {
      const resp = await fetch('/api/empresa/tom-voz', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tomVoz: valor.trim() || null }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        tomVoz?: string | null;
      };
      if (!resp.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      const salvoValor = data.tomVoz ?? '';
      setInicial(salvoValor);
      setValor(salvoValor);
      setOkMsg('Tom de voz salvo. As próximas ingestões vão usar.');
      setTimeout(() => setOkMsg(null), 4000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  function limpar() {
    setValor('');
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-bd/40 bg-surface/40">
      <header className="flex items-center justify-between border-b border-bd/40 px-5 py-3">
        <div>
          <h3 className="text-sm font-medium text-fg">Tom de voz da marca</h3>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            Define como a IA escreve as legendas dessa empresa. Se vazio, usa o
            tom padrão da Swell.
          </p>
        </div>
        {!podeEditar && (
          <span className="rounded-full bg-fg-muted/15 px-2 py-0.5 text-[10px] font-medium text-fg-muted">
            somente leitura (só owner edita)
          </span>
        )}
      </header>
      <div className="p-5">
        {carregando ? (
          <p className="text-sm text-fg-muted">Carregando…</p>
        ) : (
          <>
            <textarea
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={!podeEditar || salvando}
              rows={12}
              placeholder={PLACEHOLDER}
              className="w-full resize-y rounded-lg border border-bd/50 bg-app/60 p-3 font-mono text-[13px] text-fg placeholder:text-fg-muted/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0 text-[11px]">
                {erro && (
                  <p className="text-error">
                    <span className="font-medium">Erro:</span> {erro}
                  </p>
                )}
                {okMsg && !erro && <p className="text-success">{okMsg}</p>}
                {!erro && !okMsg && (
                  <p className="text-fg-muted">
                    {valor.trim().length > 0
                      ? `${valor.trim().length} caracteres`
                      : 'usando tom padrão da Swell'}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={limpar}
                  disabled={!podeEditar || salvando || !valor}
                  type="button"
                  className="rounded-lg border border-bd/50 px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
                >
                  Limpar
                </button>
                <button
                  onClick={salvar}
                  disabled={!podeEditar || salvando || !sujo}
                  type="button"
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-app transition-colors hover:bg-primary/85 disabled:opacity-40"
                >
                  {salvando ? 'Salvando…' : 'Salvar tom de voz'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
