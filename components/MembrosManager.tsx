'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Membro {
  userId: string;
  email: string;
  nome: string | null;
  role: string;
}

interface Convite {
  id: number;
  email: string;
  role: string;
  criadoEm: string | Date;
}

interface Props {
  empresaId: number;
  membros: Membro[];
  convites: Convite[];
}

export function MembrosManager({ empresaId, membros, convites }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'editor'>('editor');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function convidar() {
    setPending(true);
    setMsg(null);
    try {
      const resp = await fetch(`/api/admin/empresas/${empresaId}/membros`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = (await resp.json()) as
        | { status: 'membership-imediato' | 'convite-pendente' }
        | { error: string };
      if ('error' in data) {
        setMsg({ ok: false, texto: data.error });
      } else {
        setMsg({
          ok: true,
          texto:
            data.status === 'membership-imediato'
              ? '✓ Usuário já existia e foi adicionado direto.'
              : '✓ Convite criado. Quando essa pessoa logar com esse email, vira membro automaticamente.',
        });
        setEmail('');
        router.refresh();
      }
    } catch (err) {
      setMsg({ ok: false, texto: err instanceof Error ? err.message : String(err) });
    } finally {
      setPending(false);
    }
  }

  async function remover(userId: string) {
    if (!confirm('Remover este membro da empresa?')) return;
    await fetch(`/api/admin/empresas/${empresaId}/membros`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ acao: 'remover-membro', userId }),
    });
    router.refresh();
  }

  async function cancelar(conviteId: number) {
    if (!confirm('Cancelar este convite pendente?')) return;
    await fetch(`/api/admin/empresas/${empresaId}/membros`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ acao: 'cancelar-convite', conviteId }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-bd/10 bg-surface p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-muted/60">
          Convidar pessoa
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="flex-1 rounded-md border border-bd/15 bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'owner' | 'editor')}
            className="rounded-md border border-bd/15 bg-surface px-2 py-2 text-sm"
          >
            <option value="editor">editor</option>
            <option value="owner">owner</option>
          </select>
          <button
            onClick={convidar}
            disabled={pending || !email}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-app hover:opacity-90 disabled:opacity-40"
          >
            {pending ? 'Convidando…' : 'Convidar'}
          </button>
        </div>
        {msg && (
          <p
            className={
              'mt-2 text-xs ' + (msg.ok ? 'text-success' : 'text-error')
            }
          >
            {msg.texto}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-bd/10 bg-surface p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-muted/60">
          Membros ativos ({membros.length})
        </h3>
        {membros.length === 0 ? (
          <p className="text-sm text-fg-muted/55">Ninguém ainda.</p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {membros.map((m) => (
              <li key={m.userId} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{m.nome ?? m.email}</p>
                  <p className="text-xs text-fg-muted/55">
                    {m.email} · <span className="uppercase tracking-wide">{m.role}</span>
                  </p>
                </div>
                <button
                  onClick={() => remover(m.userId)}
                  className="text-xs text-error hover:underline"
                >
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-bd/10 bg-surface p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-muted/60">
          Convites pendentes ({convites.length})
        </h3>
        {convites.length === 0 ? (
          <p className="text-sm text-fg-muted/55">Nenhum.</p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {convites.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{c.email}</p>
                  <p className="text-xs text-fg-muted/55">
                    Vai virar <strong>{c.role}</strong> quando logar
                  </p>
                </div>
                <button
                  onClick={() => cancelar(c.id)}
                  className="text-xs text-fg-muted/60 hover:underline"
                >
                  cancelar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
