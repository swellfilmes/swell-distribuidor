'use client';

import { useEffect, useState } from 'react';
import { StatusBadge, RedeBadge } from './StatusBadge';
import { InlineStatusEdit } from './InlineStatusEdit';
import { InlineDateEdit } from './InlineDateEdit';
import { formatarDataHora, formatarData } from '@/lib-web/format';
import type { PostListado } from '@/lib-web/notionData';
import type { PatchPostInput } from '@/lib-web/notionWrite';
import type { Rede } from '@/src/types';

interface Props {
  post: PostListado | null;
  pendente: boolean;
  erro: string | null;
  onSalvar: (mud: PatchPostInput, overrides: Partial<PostListado>) => void;
  onClose: () => void;
}

export function PostDetailDrawer({ post, pendente, erro, onSalvar, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (post) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [post, onClose]);

  if (!post) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-primary/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-hidden bg-app shadow-xl">
        <header className="flex items-start justify-between border-b border-bd/10 px-6 py-4">
          <div className="min-w-0 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <InlineStatusEdit
                valor={post.status}
                pendente={pendente}
                onChange={(s) => onSalvar({ status: s }, { status: s })}
              />
              {post.redes.map((r) => (
                <RedeBadge key={r} rede={r} />
              ))}
              {post.conteudoAI && (
                <span className="rounded bg-fuchsia-50 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-700 ring-1 ring-fuchsia-100">
                  AI
                </span>
              )}
            </div>
            <h2 className="mt-2 truncate text-lg font-semibold" title={post.nome}>
              {post.nome}
            </h2>
            <p className="text-xs text-fg-muted/60">
              {post.cliente} · {post.tipo} · {post.orientacao}
            </p>
            {erro && (
              <p className="mt-1 text-xs text-rose-700">⚠ {erro}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-fg-muted/60 transition-colors hover:bg-primary/5 hover:text-app"
            aria-label="Fechar"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5L15 15M5 15L15 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {post.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.thumbnailUrl}
              alt=""
              className="mb-4 w-full rounded-lg border border-bd/10 object-cover"
            />
          )}

          {post.videoUrl && (() => {
            const url = post.videoUrl.toLowerCase();
            const ehImagem =
              url.endsWith('.jpg') ||
              url.endsWith('.jpeg') ||
              url.endsWith('.png') ||
              url.endsWith('.webp');
            return (
              <details className="mb-4 rounded-lg border border-bd/10 bg-surface">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-fg-muted/80">
                  Ver {ehImagem ? 'imagem' : 'vídeo'}
                </summary>
                <div className="border-t border-bd/10 p-3">
                  {ehImagem ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.videoUrl}
                      alt={post.nome}
                      className="w-full rounded"
                    />
                  ) : (
                    <video
                      src={post.videoUrl}
                      controls
                      preload="metadata"
                      className="w-full rounded"
                    />
                  )}
                </div>
              </details>
            );
          })()}

          <Section title="Resumo">
            <p className="text-sm text-fg-muted/80">{post.resumo || '—'}</p>
          </Section>

          <Section title="Agendamento">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-fg-muted/60">DataPublicacao:</span>
              <InlineDateEdit
                iso={post.dataPublicacao}
                pendente={pendente}
                onChange={(novo) =>
                  onSalvar(
                    { dataPublicacao: novo },
                    { dataPublicacao: novo },
                  )
                }
              />
            </div>
            <dl className="mt-2 grid grid-cols-[140px_1fr] gap-y-1 text-sm">
              <dt className="text-fg-muted/60">Publicado em</dt>
              <dd>{formatarDataHora(post.publicadoEm)}</dd>
              <dt className="text-fg-muted/60">Criado em</dt>
              <dd>{formatarData(post.criadoEm)}</dd>
              <dt className="text-fg-muted/60">Atualizado em</dt>
              <dd>{formatarDataHora(post.atualizadoEm)}</dd>
            </dl>
          </Section>

          <Section title="Copy por rede (editável)">
            {post.plano && post.plano.copy.length > 0 ? (
              <div className="space-y-3">
                {post.plano.copy.map((c) => (
                  <CopyRedeEditor
                    key={c.rede}
                    rede={c.rede}
                    titulo={c.titulo}
                    descricao={c.descricao}
                    hashtags={c.hashtags}
                    pendente={pendente}
                    onSalvar={(rede, novaDescricao, novasHashtags) =>
                      onSalvar(
                        {
                          copy: {
                            [rede]: {
                              descricao: novaDescricao,
                              hashtags: novasHashtags,
                            },
                          },
                        },
                        {},
                      )
                    }
                  />
                ))}
              </div>
            ) : post.copyResumo ? (
              <>
                <p className="mb-2 text-xs text-fg-muted/50">
                  Esse post não tem PlanoJSON estruturado (provavelmente foi
                  criado antes do upgrade). Rode <code>--reparar-copy</code> pra
                  poder editar por rede aqui.
                </p>
                <pre className="whitespace-pre-wrap rounded-md border border-bd/10 bg-surface p-3 text-xs text-fg-muted/80">
                  {post.copyResumo}
                </pre>
              </>
            ) : (
              <p className="text-sm text-fg-muted/60">Sem copy ainda.</p>
            )}
          </Section>

          {post.logPublicacao && (
            <Section title="Log de publicação">
              <pre className="whitespace-pre-wrap rounded-md border border-bd/10 bg-surface p-3 text-xs text-fg-muted/80">
                {post.logPublicacao}
              </pre>
            </Section>
          )}

          <Section title="Links">
            <ul className="space-y-1 text-sm">
              {post.linkPublicado && (
                <li>
                  <a
                    href={post.linkPublicado}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline hover:opacity-80"
                  >
                    Post publicado ↗
                  </a>
                </li>
              )}
              {post.zernioPostId && (
                <li className="text-fg-muted/70">
                  Zernio post id:{' '}
                  <code className="rounded bg-surface px-1 py-0.5 text-xs ring-1 ring-primary/10">
                    {post.zernioPostId}
                  </code>
                </li>
              )}
              <li>
                <a
                  href={post.notionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline hover:opacity-80"
                >
                  Abrir no Notion ↗
                </a>
              </li>
            </ul>
          </Section>

          <Section title="Ações">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  onSalvar({ status: 'Aprovado' }, { status: 'Aprovado' })
                }
                disabled={pendente || post.status === 'Aprovado'}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                ✓ Aprovar
              </button>
              <button
                onClick={() =>
                  onSalvar({ status: 'Rejeitado' }, { status: 'Rejeitado' })
                }
                disabled={pendente || post.status === 'Rejeitado'}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-40"
              >
                ✗ Rejeitar
              </button>
              <button
                onClick={() =>
                  onSalvar({ status: 'Aguardando' }, { status: 'Aguardando' })
                }
                disabled={pendente || post.status === 'Aguardando'}
                className="rounded-md border border-bd/15 px-3 py-1.5 text-sm font-medium text-fg-muted/80 hover:bg-primary/5 disabled:opacity-40"
              >
                ↺ Voltar pra Aguardando
              </button>
            </div>
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted/50">
        {title}
      </h3>
      {children}
    </section>
  );
}

function CopyRedeEditor({
  rede,
  titulo,
  descricao,
  hashtags,
  pendente,
  onSalvar,
}: {
  rede: Rede;
  titulo?: string;
  descricao: string;
  hashtags: string[];
  pendente: boolean;
  onSalvar: (rede: Rede, descricao: string, hashtags: string[]) => void;
}) {
  const [valorDesc, setValorDesc] = useState(descricao);
  const [valorTags, setValorTags] = useState(hashtags.join(' '));
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    setValorDesc(descricao);
    setValorTags(hashtags.join(' '));
  }, [descricao, hashtags]);

  const sujo =
    valorDesc !== descricao || valorTags.trim() !== hashtags.join(' ').trim();

  function salvar() {
    const novasTags = valorTags
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    onSalvar(rede, valorDesc, novasTags);
    setEditando(false);
  }

  function cancelar() {
    setValorDesc(descricao);
    setValorTags(hashtags.join(' '));
    setEditando(false);
  }

  return (
    <div className="rounded-md border border-bd/10 bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RedeBadge rede={rede} />
          {titulo && (
            <span className="text-xs font-medium text-fg-muted/80">{titulo}</span>
          )}
        </div>
        {!editando && (
          <button
            onClick={() => setEditando(true)}
            disabled={pendente}
            className="text-xs text-fg-muted/60 hover:text-fg hover:underline disabled:opacity-40"
          >
            editar
          </button>
        )}
      </div>
      {editando ? (
        <>
          <textarea
            value={valorDesc}
            onChange={(e) => setValorDesc(e.target.value)}
            disabled={pendente}
            rows={Math.max(3, Math.min(12, valorDesc.split('\n').length + 1))}
            className="w-full resize-y rounded border border-bd/15 bg-cream/50 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            value={valorTags}
            onChange={(e) => setValorTags(e.target.value)}
            disabled={pendente}
            placeholder="#hashtag1 #hashtag2"
            className="mt-1 w-full rounded border border-bd/15 bg-cream/50 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={cancelar}
              disabled={pendente}
              className="rounded-md px-2 py-1 text-xs text-fg-muted/60 hover:bg-primary/5 disabled:opacity-40"
            >
              cancelar
            </button>
            <button
              onClick={salvar}
              disabled={pendente || !sujo}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-app hover:opacity-90 disabled:opacity-40"
            >
              {pendente ? 'salvando…' : 'salvar'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm text-fg-muted/85">{descricao}</p>
          {hashtags.length > 0 && (
            <p className="mt-1 text-xs text-fg-muted/55">{hashtags.join(' ')}</p>
          )}
        </>
      )}
    </div>
  );
}
