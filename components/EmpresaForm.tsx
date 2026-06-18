'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Valores {
  nome: string;
  slug: string;
  notionApiKey: string;
  notionDbId: string;
  zernioApiKey: string;
  zernioYoutubeAccountId: string;
  zernioInstagramAccountId: string;
  zernioTiktokAccountId: string;
  zernioLinkedinAccountId: string;
}

interface Props {
  modo: 'criar' | 'editar';
  /** Quando modo=editar, valores iniciais (chaves já descifradas). */
  inicial?: Partial<Valores>;
  empresaId?: number;
}

interface TestResult {
  notion?: { ok: true; nomeDb: string } | { ok: false; erro: string };
  zernio?:
    | { ok: true; contas: Array<{ platform: string; _id: string }> }
    | { ok: false; erro: string };
}

const SLUG_REGEX = /^[a-z0-9-]+$/;

export function EmpresaForm({ modo, inicial, empresaId }: Props) {
  const router = useRouter();
  const [v, setV] = useState<Valores>({
    nome: inicial?.nome ?? '',
    slug: inicial?.slug ?? '',
    notionApiKey: inicial?.notionApiKey ?? '',
    notionDbId: inicial?.notionDbId ?? '',
    zernioApiKey: inicial?.zernioApiKey ?? '',
    zernioYoutubeAccountId: inicial?.zernioYoutubeAccountId ?? '',
    zernioInstagramAccountId: inicial?.zernioInstagramAccountId ?? '',
    zernioTiktokAccountId: inicial?.zernioTiktokAccountId ?? '',
    zernioLinkedinAccountId: inicial?.zernioLinkedinAccountId ?? '',
  });
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function up<K extends keyof Valores>(k: K, val: string) {
    setV((s) => ({ ...s, [k]: val }));
  }

  async function testar() {
    setTestando(true);
    setTest(null);
    setErro(null);
    try {
      const resp = await fetch('/api/admin/testar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          notionApiKey: v.notionApiKey,
          notionDbId: v.notionDbId,
          zernioApiKey: v.zernioApiKey,
        }),
      });
      const data = (await resp.json()) as TestResult;
      setTest(data);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setTestando(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (modo === 'criar') {
        if (!SLUG_REGEX.test(v.slug)) {
          throw new Error('Slug só pode ter letras minúsculas, números e hífens.');
        }
        const resp = await fetch('/api/admin/empresas', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            nome: v.nome,
            slug: v.slug,
            notionApiKey: v.notionApiKey,
            notionDbId: v.notionDbId,
            zernioApiKey: v.zernioApiKey,
            zernioYoutubeAccountId: v.zernioYoutubeAccountId || undefined,
            zernioInstagramAccountId: v.zernioInstagramAccountId || undefined,
            zernioTiktokAccountId: v.zernioTiktokAccountId || undefined,
            zernioLinkedinAccountId: v.zernioLinkedinAccountId || undefined,
          }),
        });
        if (!resp.ok) {
          const d = (await resp.json().catch(() => ({}))) as { error?: string };
          throw new Error(d.error ?? `HTTP ${resp.status}`);
        }
        const d = (await resp.json()) as { id: number };
        router.push(`/app/admin/empresas/${d.id}`);
        return;
      }
      // editar
      if (!empresaId) throw new Error('empresaId ausente');
      const resp = await fetch(`/api/admin/empresas/${empresaId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nome: v.nome,
          segredos: {
            // Só envia chaves se mudaram (compara com inicial)
            notionApiKey:
              v.notionApiKey !== inicial?.notionApiKey ? v.notionApiKey : undefined,
            notionDbId:
              v.notionDbId !== inicial?.notionDbId ? v.notionDbId : undefined,
            zernioApiKey:
              v.zernioApiKey !== inicial?.zernioApiKey ? v.zernioApiKey : undefined,
            zernioYoutubeAccountId:
              v.zernioYoutubeAccountId !== inicial?.zernioYoutubeAccountId
                ? v.zernioYoutubeAccountId
                : undefined,
            zernioInstagramAccountId:
              v.zernioInstagramAccountId !== inicial?.zernioInstagramAccountId
                ? v.zernioInstagramAccountId
                : undefined,
            zernioTiktokAccountId:
              v.zernioTiktokAccountId !== inicial?.zernioTiktokAccountId
                ? v.zernioTiktokAccountId
                : undefined,
            zernioLinkedinAccountId:
              v.zernioLinkedinAccountId !== inicial?.zernioLinkedinAccountId
                ? v.zernioLinkedinAccountId
                : undefined,
          },
        }),
      });
      if (!resp.ok) {
        const d = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `HTTP ${resp.status}`);
      }
      router.refresh();
      setTest({ notion: { ok: true, nomeDb: '(salvo)' } });
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <Bloco titulo="Identificação">
        <Campo label="Nome" value={v.nome} onChange={(x) => up('nome', x)} placeholder="Ex: Becogelato" />
        <Campo
          label="Slug (URL-safe)"
          value={v.slug}
          onChange={(x) => up('slug', x)}
          placeholder="becogelato"
          disabled={modo === 'editar'}
          hint={
            modo === 'editar'
              ? 'Slug não pode mudar depois de criada.'
              : 'Letras minúsculas, números e hífens.'
          }
        />
      </Bloco>

      <Bloco titulo="Notion">
        <Campo
          label="API Key"
          value={v.notionApiKey}
          onChange={(x) => up('notionApiKey', x)}
          placeholder="ntn_..."
          tipo="senha"
        />
        <Campo
          label="Database ID"
          value={v.notionDbId}
          onChange={(x) => up('notionDbId', x)}
          placeholder="ID do database da fila no Notion"
        />
      </Bloco>

      <Bloco titulo="Zernio">
        <Campo
          label="API Key"
          value={v.zernioApiKey}
          onChange={(x) => up('zernioApiKey', x)}
          placeholder="sk_..."
          tipo="senha"
        />
        <div className="grid grid-cols-2 gap-3">
          <Campo
            label="YouTube account ID"
            value={v.zernioYoutubeAccountId}
            onChange={(x) => up('zernioYoutubeAccountId', x)}
            placeholder="(opcional)"
          />
          <Campo
            label="Instagram account ID"
            value={v.zernioInstagramAccountId}
            onChange={(x) => up('zernioInstagramAccountId', x)}
            placeholder="(opcional)"
          />
          <Campo
            label="TikTok account ID"
            value={v.zernioTiktokAccountId}
            onChange={(x) => up('zernioTiktokAccountId', x)}
            placeholder="(opcional)"
          />
          <Campo
            label="LinkedIn account ID"
            value={v.zernioLinkedinAccountId}
            onChange={(x) => up('zernioLinkedinAccountId', x)}
            placeholder="(opcional)"
          />
        </div>
        <p className="text-xs text-ink/55">
          Pra pegar os account IDs: conecta as redes no painel Zernio, depois
          rode <code>npm run distribuir -- --empresa &lt;slug&gt; --listar-contas</code> pra
          ver os IDs (ou veja o resultado do botão "Testar conexão" abaixo).
        </p>
      </Bloco>

      {test && (
        <div className="rounded-md border border-ink/10 bg-white p-4 text-sm">
          <h4 className="mb-2 font-medium">Resultado do teste:</h4>
          {test.notion && (
            <p>
              <strong>Notion:</strong>{' '}
              {test.notion.ok ? (
                <span className="text-emerald-700">
                  ✓ conectado. DB: {test.notion.nomeDb}
                </span>
              ) : (
                <span className="text-rose-700">✗ {test.notion.erro}</span>
              )}
            </p>
          )}
          {test.zernio && (
            <p>
              <strong>Zernio:</strong>{' '}
              {test.zernio.ok ? (
                <>
                  <span className="text-emerald-700">
                    ✓ conectado ({test.zernio.contas.length} contas)
                  </span>
                  {test.zernio.contas.length > 0 && (
                    <ul className="ml-4 mt-1 list-disc text-xs">
                      {test.zernio.contas.map((c) => (
                        <li key={c._id}>
                          <code>{c.platform}</code> → <code>{c._id}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <span className="text-rose-700">✗ {test.zernio.erro}</span>
              )}
            </p>
          )}
        </div>
      )}

      {erro && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-900">
          {erro}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={testar}
          disabled={testando || !v.notionApiKey || !v.zernioApiKey}
          className="rounded-md border border-ink/20 px-3 py-2 text-sm font-medium text-ink/80 hover:bg-ink/5 disabled:opacity-40"
        >
          {testando ? 'Testando…' : 'Testar conexão'}
        </button>
        <button
          onClick={salvar}
          disabled={salvando || !v.nome || !v.slug || !v.notionApiKey || !v.notionDbId || !v.zernioApiKey}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-40"
        >
          {salvando ? 'Salvando…' : modo === 'criar' ? 'Criar empresa' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/60">
        {titulo}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  hint,
  disabled,
  tipo = 'texto',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  tipo?: 'texto' | 'senha';
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink/70">{label}</span>
      <input
        type={tipo === 'senha' ? 'password' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 disabled:bg-ink/5 disabled:opacity-60"
      />
      {hint && <span className="mt-1 block text-[11px] text-ink/50">{hint}</span>}
    </label>
  );
}
