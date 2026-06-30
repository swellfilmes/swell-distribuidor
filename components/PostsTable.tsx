'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { StatusBadge, RedeBadge } from './StatusBadge';
import { InlineStatusEdit } from './InlineStatusEdit';
import { InlineDateEdit } from './InlineDateEdit';
import { PostDetailDrawer } from './PostDetailDrawer';
import { CalendarView } from './CalendarView';
import { formatarDataHora, tempoRelativo } from '@/lib-web/format';
import {
  STATUS_VALORES,
  TIPO_VALORES,
  REDE_VALORES,
  type PostListado,
  type CampoSort,
  type DirecaoSort,
} from '@/lib-web/notionData';
import type { PatchPostInput } from '@/lib-web/notionWrite';

interface Props {
  posts: PostListado[];
  clientes: string[];
  filtros: {
    status?: string;
    cliente?: string;
    mes?: string;
    tipo?: string;
    redes?: string[];
  };
  ordem: { sort: CampoSort; dir: DirecaoSort };
  geradoEm: string;
}

interface ColunaSort {
  campo: CampoSort;
  label: string;
}

const COLUNAS_SORT: Record<string, ColunaSort> = {
  status: { campo: 'status', label: 'Status' },
  cliente: { campo: 'cliente', label: 'Cliente' },
  tipo: { campo: 'tipo', label: 'Tipo' },
  data: { campo: 'dataPublicacao', label: 'Quando' },
  atualizado: { campo: 'atualizado', label: 'Atualizado' },
};

/**
 * Quando o usuário arrasta um post de um dia pra outro no calendário, queremos
 * preservar a HORA original (ex: post agendado pras 18:30 continua às 18:30,
 * só muda o dia). Se não tinha hora ou nem data, default 09:00 Brasília.
 */
function novaDataPreservandoHora(
  dataOriginalIso: string | null | undefined,
  novoDiaIso: string,
): string {
  const original = dataOriginalIso ?? '';
  const m = original.match(/T(\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2}:?\d{2}|Z)?/);
  if (m) {
    const hora = m[1];
    const tz = m[2] ?? '-03:00';
    return `${novoDiaIso}T${hora}${tz}`;
  }
  return `${novoDiaIso}T09:00:00-03:00`;
}

export function PostsTable({ posts: postsServer, clientes, filtros, ordem, geradoEm }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Optimistic state: clona do servidor e aplica overrides locais até o próximo refresh.
  const [posts, setPosts] = useState<PostListado[]>(postsServer);
  const [pendentes, setPendentes] = useState<Set<string>>(new Set());
  const [erros, setErros] = useState<Map<string, string>>(new Map());
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tabela' | 'calendario'>(
    (searchParams.get('view') as 'tabela' | 'calendario') ?? 'tabela',
  );
  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSync, setResultadoSync] = useState<{ ok: boolean; msg: string } | null>(null);

  async function sincronizarZernio() {
    setSincronizando(true);
    setResultadoSync(null);
    try {
      const resp = await fetch('/api/sync-zernio', { method: 'POST' });
      const data = (await resp.json()) as
        | { ok: true; duracaoMs: number; logs: string[] }
        | { error: string };
      if ('error' in data) {
        setResultadoSync({ ok: false, msg: data.error });
      } else {
        const seg = (data.duracaoMs / 1000).toFixed(1);
        setResultadoSync({
          ok: true,
          msg: `✓ Sincronizado em ${seg}s. ${data.logs.length} mensagens do worker.`,
        });
        router.refresh();
      }
    } catch (err) {
      setResultadoSync({
        ok: false,
        msg: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSincronizando(false);
      setTimeout(() => setResultadoSync(null), 6000);
    }
  }

  function trocarView(novo: 'tabela' | 'calendario') {
    setViewMode(novo);
    const sp = new URLSearchParams(searchParams.toString());
    if (novo === 'calendario') sp.set('view', 'calendario');
    else sp.delete('view');
    // troca o mês default se entrando no calendário sem mês
    if (novo === 'calendario' && !sp.get('mes')) {
      const h = new Date();
      sp.set('mes', `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`);
    }
    router.push(`${pathname}?${sp.toString()}`);
  }

  useEffect(() => {
    setPosts(postsServer);
    setPendentes(new Set());
  }, [postsServer]);

  const selecionado = useMemo(
    () => posts.find((p) => p.pageId === selecionadoId) ?? null,
    [posts, selecionadoId],
  );

  function setFiltro(chave: keyof Props['filtros'], valor: string | string[]) {
    const sp = new URLSearchParams(searchParams.toString());
    if (Array.isArray(valor)) {
      if (valor.length > 0) sp.set(chave, valor.join(','));
      else sp.delete(chave);
    } else if (valor) {
      sp.set(chave, valor);
    } else {
      sp.delete(chave);
    }
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  function limparFiltros() {
    startTransition(() => router.push(pathname));
  }

  function refrescar() {
    startTransition(() => router.refresh());
  }

  function alternarSort(campo: CampoSort) {
    const sp = new URLSearchParams(searchParams.toString());
    let novoDir: DirecaoSort = 'desc';
    if (ordem.sort === campo) {
      novoDir = ordem.dir === 'desc' ? 'asc' : 'desc';
    }
    sp.set('sort', campo);
    sp.set('dir', novoDir);
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  const salvar = useCallback(
    async (pageId: string, mudancas: PatchPostInput, overrides: Partial<PostListado>) => {
      setPosts((atual) =>
        atual.map((p) => (p.pageId === pageId ? { ...p, ...overrides } : p)),
      );
      setPendentes((s) => {
        const n = new Set(s);
        n.add(pageId);
        return n;
      });
      setErros((m) => {
        const n = new Map(m);
        n.delete(pageId);
        return n;
      });
      try {
        const resp = await fetch(`/api/posts/${pageId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(mudancas),
        });
        if (!resp.ok) {
          const data = (await resp.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${resp.status}`);
        }
        // Servidor não devolve o post (otimização Onda 1: 1 roundtrip).
        // Estado otimista permanece; auto-refresh 30s reconcilia.
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErros((m) => {
          const n = new Map(m);
          n.set(pageId, msg);
          return n;
        });
        // Reverte buscando do servidor
        startTransition(() => router.refresh());
      } finally {
        setPendentes((s) => {
          const n = new Set(s);
          n.delete(pageId);
          return n;
        });
      }
    },
    [router],
  );

  // Auto-refresh a cada 30s (só se não tem edição pendente, pra não atropelar)
  useEffect(() => {
    const id = setInterval(() => {
      if (pendentes.size === 0) router.refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [router, pendentes]);

  const algumFiltro =
    Boolean(filtros.status) ||
    Boolean(filtros.cliente) ||
    Boolean(filtros.mes) ||
    Boolean(filtros.tipo) ||
    (filtros.redes && filtros.redes.length > 0);

  const mesAtivo =
    filtros.mes ??
    (() => {
      const h = new Date();
      return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
    })();

  return (
    <>
      {/* Toggle de view */}
      <div className="mb-3 inline-flex overflow-hidden rounded-md border border-bd/15">
        <button
          onClick={() => trocarView('tabela')}
          className={
            'px-3 py-1.5 text-sm ' +
            (viewMode === 'tabela'
              ? 'bg-primary text-app'
              : 'bg-surface text-fg-muted/70 hover:bg-primary/5')
          }
        >
          Tabela
        </button>
        <button
          onClick={() => trocarView('calendario')}
          className={
            'border-l border-bd/15 px-3 py-1.5 text-sm ' +
            (viewMode === 'calendario'
              ? 'bg-primary text-app'
              : 'bg-surface text-fg-muted/70 hover:bg-primary/5')
          }
        >
          Calendário
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-bd/10 bg-surface p-3">
        <FiltroSelect
          label="Status"
          valor={filtros.status ?? ''}
          opcoes={['', ...STATUS_VALORES]}
          onChange={(v) => setFiltro('status', v)}
          rotulos={{ '': 'Todos' }}
        />
        <FiltroSelect
          label="Cliente"
          valor={filtros.cliente ?? ''}
          opcoes={['', ...clientes]}
          onChange={(v) => setFiltro('cliente', v)}
          rotulos={{ '': 'Todos' }}
        />
        <FiltroSelect
          label="Tipo"
          valor={filtros.tipo ?? ''}
          opcoes={['', ...TIPO_VALORES]}
          onChange={(v) => setFiltro('tipo', v)}
          rotulos={{ '': 'Todos' }}
        />
        <div>
          <label className="block text-xs uppercase tracking-wide text-fg-muted/50">
            Redes
          </label>
          <div className="mt-1 flex gap-1">
            {REDE_VALORES.map((r) => {
              const ativa = filtros.redes?.includes(r) ?? false;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    const cur = filtros.redes ?? [];
                    const nova = ativa
                      ? cur.filter((x) => x !== r)
                      : [...cur, r];
                    setFiltro('redes', nova);
                  }}
                  className={
                    'rounded px-2 py-1 text-[10px] font-semibold ring-1 ring-inset transition ' +
                    (ativa
                      ? 'bg-primary text-app ring-primary'
                      : 'bg-surface text-fg-muted/60 ring-primary/15 hover:ring-primary/30')
                  }
                >
                  {r.slice(0, 2).toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-fg-muted/50">
            Mês
          </label>
          <input
            type="month"
            value={filtros.mes ?? ''}
            onChange={(e) => setFiltro('mes', e.target.value)}
            className="mt-1 rounded-md border border-bd/15 bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {algumFiltro && (
          <button
            onClick={limparFiltros}
            className="rounded-md px-2 py-1.5 text-xs text-fg-muted/60 hover:bg-primary/5"
          >
            Limpar filtros
          </button>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-fg-muted/50">
          <span>Atualizado {tempoRelativo(geradoEm)} atrás</span>
          <button
            onClick={sincronizarZernio}
            disabled={sincronizando}
            title="Puxa o status de cada post do Zernio e atualiza no Notion (Agendado → Publicado etc.). Cron faz isso sozinho a cada 15min."
            className="rounded-md border border-bd/15 px-2 py-1 text-fg-muted/80 hover:bg-primary/5 disabled:opacity-60"
          >
            {sincronizando ? 'Sincronizando…' : '↻ Sync Zernio'}
          </button>
          <button
            onClick={refrescar}
            disabled={pending}
            className="rounded-md border border-bd/15 px-2 py-1 text-fg-muted/80 hover:bg-primary/5 disabled:opacity-60"
          >
            {pending ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {resultadoSync && (
        <div
          className={
            'mb-3 rounded-md px-3 py-2 text-sm ' +
            (resultadoSync.ok
              ? 'border border-success/30 bg-success/10 text-success'
              : 'border border-error/30 bg-error/10 text-error')
          }
        >
          {resultadoSync.msg}
        </div>
      )}

      {viewMode === 'calendario' && (
        <CalendarView
          posts={posts}
          mes={mesAtivo}
          onMesChange={(novo) => setFiltro('mes', novo)}
          onSelecionar={(p) => setSelecionadoId(p.pageId)}
          pendentes={pendentes}
          onMoverPost={(pageId, novoDiaIso) => {
            const post = posts.find((x) => x.pageId === pageId);
            if (!post) return;
            const nova = novaDataPreservandoHora(
              post.dataPublicacao ?? post.publicadoEm,
              novoDiaIso,
            );
            salvar(
              pageId,
              { dataPublicacao: nova },
              { dataPublicacao: nova },
            );
          }}
        />
      )}

      {/* Tabela */}
      {viewMode === 'tabela' && (
      <div className="overflow-hidden rounded-lg border border-bd/10 bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-bd/10 bg-primary/[0.02] text-left text-xs uppercase tracking-wide text-fg-muted/60">
            <tr>
              <th className="w-16 px-3 py-2"> </th>
              <ColunaHeader
                col={COLUNAS_SORT.status}
                ordem={ordem}
                onClick={() => alternarSort('status')}
              />
              <ColunaHeader
                col={COLUNAS_SORT.cliente}
                ordem={ordem}
                onClick={() => alternarSort('cliente')}
              />
              <ColunaHeader
                col={COLUNAS_SORT.tipo}
                ordem={ordem}
                onClick={() => alternarSort('tipo')}
              />
              <th className="px-3 py-2">Redes</th>
              <th className="px-3 py-2">Título</th>
              <ColunaHeader
                col={COLUNAS_SORT.data}
                ordem={ordem}
                onClick={() => alternarSort('dataPublicacao')}
              />
              <ColunaHeader
                col={COLUNAS_SORT.atualizado}
                ordem={ordem}
                onClick={() => alternarSort('atualizado')}
              />
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-fg-muted/50">
                  Nenhum post encontrado com esses filtros.
                </td>
              </tr>
            )}
            {posts.map((p) => {
              const isPendente = pendentes.has(p.pageId);
              const erro = erros.get(p.pageId);
              return (
                <tr
                  key={p.pageId}
                  onClick={() => setSelecionadoId(p.pageId)}
                  className="cursor-pointer border-b border-bd/5 transition-colors last:border-0 hover:bg-primary/[0.03]"
                >
                  <td className="px-3 py-2">
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnailUrl}
                        alt=""
                        className="h-10 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-12 rounded bg-primary/5" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <InlineStatusEdit
                      valor={p.status}
                      pendente={isPendente}
                      onChange={(novo) =>
                        salvar(p.pageId, { status: novo }, { status: novo })
                      }
                    />
                    {erro && (
                      <div
                        className="mt-1 text-[10px] text-error"
                        title={erro}
                      >
                        ⚠ erro salvando
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-fg-muted/80">{p.cliente || '—'}</td>
                  <td className="px-3 py-2 text-fg-muted/70">{p.tipo || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.redes.map((r) => (
                        <RedeBadge key={r} rede={r} />
                      ))}
                    </div>
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-fg-muted/85" title={p.nome}>
                    {p.nome}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-fg-muted/65">
                    <InlineDateEdit
                      iso={p.dataPublicacao}
                      pendente={isPendente}
                      onChange={(novo) =>
                        salvar(
                          p.pageId,
                          { dataPublicacao: novo },
                          { dataPublicacao: novo },
                        )
                      }
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-fg-muted/50">
                    {tempoRelativo(p.atualizadoEm)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      <PostDetailDrawer
        post={selecionado}
        pendente={selecionado ? pendentes.has(selecionado.pageId) : false}
        erro={selecionado ? erros.get(selecionado.pageId) ?? null : null}
        onSalvar={(mud, over) => {
          if (selecionado) salvar(selecionado.pageId, mud, over);
        }}
        onClose={() => setSelecionadoId(null)}
      />
    </>
  );
}

function ColunaHeader({
  col,
  ordem,
  onClick,
}: {
  col: ColunaSort;
  ordem: { sort: CampoSort; dir: DirecaoSort };
  onClick: () => void;
}) {
  const ativo = ordem.sort === col.campo;
  return (
    <th className="px-3 py-2">
      <button
        type="button"
        onClick={onClick}
        className={
          'flex items-center gap-1 uppercase tracking-wide ' +
          (ativo ? 'text-fg' : 'text-fg-muted/60 hover:text-fg-muted/80')
        }
      >
        {col.label}
        <span className="text-[10px]">
          {ativo ? (ordem.dir === 'desc' ? '↓' : '↑') : '·'}
        </span>
      </button>
    </th>
  );
}

function FiltroSelect({
  label,
  valor,
  opcoes,
  onChange,
  rotulos = {},
}: {
  label: string;
  valor: string;
  opcoes: readonly string[];
  onChange: (v: string) => void;
  rotulos?: Record<string, string>;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-fg-muted/50">
        {label}
      </label>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-md border border-bd/15 bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {rotulos[o] ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}
