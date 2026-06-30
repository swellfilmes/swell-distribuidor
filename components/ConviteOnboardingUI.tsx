'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  token: string;
  jaLogado: boolean;
  emailSugerido: string | null;
  nomeEmpresaSugerido: string | null;
}

function slugDe(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

export function ConviteOnboardingUI({
  token,
  jaLogado,
  emailSugerido,
  nomeEmpresaSugerido,
}: Props) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeEmpresaSugerido ?? '');
  const [slug, setSlug] = useState(slugDe(nomeEmpresaSugerido ?? ''));
  const [slugEditado, setSlugEditado] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const slugEfetivo = useMemo(() => (slugEditado ? slug : slugDe(nome)), [
    nome,
    slug,
    slugEditado,
  ]);

  if (!jaLogado) {
    const signupUrl = `/sign-up?redirect_url=${encodeURIComponent(`/convite/${token}`)}`;
    const signinUrl = `/sign-in?redirect_url=${encodeURIComponent(`/convite/${token}`)}`;
    return (
      <div className="space-y-4 rounded-2xl border border-border-soft/40 bg-surface/60 p-6 backdrop-blur">
        <div className="text-sm text-text-secondary">
          Antes de criar sua empresa, faça login ou crie sua conta.
        </div>
        {emailSugerido && (
          <div className="rounded-lg border border-primary/20 bg-primary/8 px-3 py-2 text-xs text-text-primary">
            💡 Quem te convidou sugeriu o email <b className="text-primary">{emailSugerido}</b> — você pode usar esse ou outro.
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={signupUrl}
            className="flex-1 rounded-lg bg-primary px-4 py-3 text-center text-sm font-medium text-app hover:opacity-90"
          >
            Criar conta
          </a>
          <a
            href={signinUrl}
            className="flex-1 rounded-lg border border-border-soft/40 px-4 py-3 text-center text-sm font-medium text-text-primary hover:bg-surface-2/60"
          >
            Já tenho conta
          </a>
        </div>
      </div>
    );
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setCriando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/convites-onboarding/${token}/consumir`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nomeEmpresa: nome, slug: slugEfetivo }),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string; empresaId?: number };
      if (!resp.ok || !data.empresaId) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      // sucesso → wizard de onboarding
      router.push(`/app/onboarding?empresa=${data.empresaId}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setCriando(false);
    }
  }

  return (
    <form
      onSubmit={submeter}
      className="space-y-5 rounded-2xl border border-border-soft/40 bg-surface/60 p-6 backdrop-blur"
    >
      <div className="space-y-1.5">
        <label className="text-[13px] font-medium text-text-primary">Nome da sua empresa</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Becogelato"
          required
          autoFocus
          className="w-full rounded-lg border border-border-soft/40 bg-surface-2/60 px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary/50 focus:border-primary/60 focus:bg-surface-2 focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium text-text-primary">
          Slug <span className="text-text-secondary/60">(URL, gerado automaticamente)</span>
        </label>
        <input
          type="text"
          value={slugEfetivo}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugEditado(true);
          }}
          pattern="[a-z0-9-]+"
          placeholder="becogelato"
          required
          className="w-full rounded-lg border border-border-soft/40 bg-surface-2/60 px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-secondary/50 focus:border-primary/60 focus:bg-surface-2 focus:outline-none"
        />
        <div className="text-[11px] text-text-secondary">
          Só letras minúsculas, números e hífens. Não pode mudar depois.
        </div>
      </div>

      {erro && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          {erro}
        </div>
      )}

      <button
        type="submit"
        disabled={criando || !nome.trim() || !slugEfetivo}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-app hover:opacity-90 disabled:opacity-40"
      >
        {criando ? 'Criando...' : 'Criar minha empresa →'}
      </button>

      <p className="text-center text-[11px] text-text-secondary">
        Próximo passo: você conecta seu Notion e suas redes no wizard.
      </p>
    </form>
  );
}
