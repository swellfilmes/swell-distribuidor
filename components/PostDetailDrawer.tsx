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
  /** Chamado quando o usuário confirma a exclusão. Se undefined, botão some. */
  onExcluir?: (pageId: string) => Promise<void>;
}

export function PostDetailDrawer({ post, pendente, erro, onSalvar, onClose, onExcluir }: Props) {
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
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
        className="absolute inset-0 bg-app/70 backdrop-blur-sm"
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
                <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-300 ring-1 ring-fuchsia-500/25">
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
              <p className="mt-1 text-xs text-error">⚠ {erro}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-fg-muted/60 transition-colors hover:bg-surface-2 hover:text-fg"
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

          <Section title="Redes onde vai publicar">
            <RedesEditor
              redesAtuais={post.redes}
              pendente={pendente}
              onSalvar={(novasRedes) =>
                onSalvar({ redes: novasRedes }, { redes: novasRedes })
              }
            />
            <p className="mt-2 text-[11px] text-fg-muted">
              Desmarque pra não publicar em alguma rede. A lista aqui vale na hora de publicar.
            </p>
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
                    onSalvar={(rede, novaDescricao, novasHashtags) => {
                      // Update otimista: reconstroi o plano com a nova copy
                      // dessa rede. Sem isso, o CopyRedeEditor sai do modo
                      // edição, recebe a descrição antiga via props e o
                      // useEffect [descricao, hashtags] resetava o texto
                      // local pra versão antiga — parecia que "voltou".
                      const planoAtual = post.plano;
                      if (!planoAtual) return;
                      const novaCopyLista = planoAtual.copy.map((item) =>
                        item.rede === rede
                          ? { ...item, descricao: novaDescricao, hashtags: novasHashtags }
                          : item,
                      );
                      const novoPlano = { ...planoAtual, copy: novaCopyLista };
                      onSalvar(
                        {
                          copy: {
                            [rede]: {
                              descricao: novaDescricao,
                              hashtags: novasHashtags,
                            },
                          },
                        },
                        { plano: novoPlano },
                      );
                    }}
                  />
                ))}
              </div>
            ) : post.copyResumo ? (
              <>
                <p className="mb-2 text-xs text-fg-muted/50">
                  Esse post não tem legenda estruturada por rede ainda
                  (provavelmente foi criado antes de uma atualização). Você
                  ainda vê o texto salvo abaixo, mas edição inline por rede
                  fica indisponível.
                </p>
                <pre className="whitespace-pre-wrap rounded-md border border-bd/10 bg-surface p-3 text-xs text-fg-muted/80">
                  {post.copyResumo}
                </pre>
              </>
            ) : (
              <p className="text-sm text-fg-muted/60">Sem copy ainda.</p>
            )}
          </Section>

          {post.plano && (
            <Section title="Ajustar legenda com IA">
              <AjustarCopyIA
                pageId={post.pageId}
                pendente={pendente}
                onSucesso={(novoPlano) => {
                  // Update otimista: injeta o plano novo no post local pra
                  // o CopyRedeEditor de cada rede pegar a copy nova.
                  onSalvar({}, { plano: novoPlano });
                }}
              />
            </Section>
          )}

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
              {post.zernioPostId && !post.zernioPostId.startsWith('PROCESSING-') && (
                <li className="text-fg-muted/70">
                  ID de publicação:{' '}
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
            <div className="mb-2 flex items-center gap-2 text-xs text-fg-muted">
              <span>Status atual:</span>
              <StatusBadge status={post.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  onSalvar({ status: 'Aprovado' }, { status: 'Aprovado' })
                }
                disabled={pendente || post.status === 'Aprovado'}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-app transition-colors hover:bg-primary/85 disabled:opacity-40"
              >
                {post.status === 'Aprovado' ? '✓ Aprovado' : 'Aprovar'}
              </button>
              <button
                onClick={() =>
                  onSalvar({ status: 'Rejeitado' }, { status: 'Rejeitado' })
                }
                disabled={pendente || post.status === 'Rejeitado'}
                className="rounded-lg border border-error/40 bg-error/10 px-3 py-1.5 text-sm font-medium text-error transition-colors hover:bg-error/20 disabled:opacity-40"
              >
                {post.status === 'Rejeitado' ? '✓ Rejeitado' : 'Rejeitar'}
              </button>
              <button
                onClick={() =>
                  onSalvar({ status: 'Aguardando' }, { status: 'Aguardando' })
                }
                disabled={pendente || post.status === 'Aguardando'}
                className="rounded-lg border border-bd/50 px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
              >
                Voltar pra Aguardando
              </button>
            </div>
          </Section>

          {onExcluir && (
            <Section title="Zona de perigo">
              {!confirmandoExclusao ? (
                <button
                  onClick={() => {
                    setErroExclusao(null);
                    setConfirmandoExclusao(true);
                  }}
                  disabled={pendente || excluindo}
                  className="rounded-lg border border-error/40 px-3 py-1.5 text-sm font-medium text-error transition-colors hover:bg-error/10 disabled:opacity-40"
                >
                  Excluir post
                </button>
              ) : (
                <div className="rounded-lg border border-error/40 bg-error/5 p-3">
                  <p className="text-sm text-fg">
                    Excluir <span className="font-medium">{post.nome}</span>?
                  </p>
                  <p className="mt-1 text-xs text-fg-muted">
                    Isso vai:
                    <br />• Apagar o vídeo/imagem do armazenamento (irreversível)
                    <br />• Cancelar o agendamento nas redes se houver
                    <br />• Arquivar a página no Notion
                    {post.status === 'Publicado' || post.status === 'Publicado parcial' ? (
                      <>
                        <br />
                        <span className="text-error">
                          ⚠️ Esse post JÁ FOI PUBLICADO nas redes. A exclusão aqui não remove ele
                          das plataformas — você precisa deletar manualmente no Instagram, YouTube,
                          etc.
                        </span>
                      </>
                    ) : null}
                  </p>
                  {erroExclusao && (
                    <p className="mt-2 text-xs text-error">Erro: {erroExclusao}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setConfirmandoExclusao(false)}
                      disabled={excluindo}
                      className="rounded-lg border border-bd/50 px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        setExcluindo(true);
                        setErroExclusao(null);
                        try {
                          await onExcluir(post.pageId);
                          // Drawer fechado pelo pai via onClose no callback.
                        } catch (e) {
                          setErroExclusao(e instanceof Error ? e.message : String(e));
                          setExcluindo(false);
                        }
                      }}
                      disabled={excluindo}
                      className="rounded-lg bg-error px-3 py-1.5 text-xs font-medium text-app transition-colors hover:bg-error/85 disabled:opacity-40"
                    >
                      {excluindo ? 'Excluindo…' : 'Sim, excluir permanentemente'}
                    </button>
                  </div>
                </div>
              )}
            </Section>
          )}
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

const REDES_DISPONIVEIS: Array<{ slug: Rede; nome: string }> = [
  { slug: 'instagram', nome: 'Instagram' },
  { slug: 'youtube', nome: 'YouTube' },
  { slug: 'tiktok', nome: 'TikTok' },
  { slug: 'linkedin', nome: 'LinkedIn' },
];

function RedesEditor({
  redesAtuais,
  pendente,
  onSalvar,
}: {
  redesAtuais: Rede[];
  pendente: boolean;
  onSalvar: (novas: Rede[]) => void;
}) {
  function toggle(slug: Rede) {
    if (pendente) return;
    const setAtual = new Set<Rede>(redesAtuais);
    if (setAtual.has(slug)) setAtual.delete(slug);
    else setAtual.add(slug);
    onSalvar(Array.from(setAtual));
  }
  return (
    <div className="flex flex-wrap gap-2">
      {REDES_DISPONIVEIS.map((r) => {
        const ativo = redesAtuais.includes(r.slug);
        return (
          <button
            key={r.slug}
            onClick={() => toggle(r.slug)}
            disabled={pendente}
            className={[
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              ativo
                ? 'border-primary/60 bg-primary/15 text-primary'
                : 'border-bd/40 bg-surface/40 text-fg-muted hover:border-bd/70 hover:text-fg',
              pendente ? 'cursor-wait opacity-60' : '',
            ].join(' ')}
          >
            {ativo && <span className="mr-1">✓</span>}
            {r.nome}
          </button>
        );
      })}
    </div>
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
            className="w-full resize-y rounded border border-bd/15 bg-surface/60 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            value={valorTags}
            onChange={(e) => setValorTags(e.target.value)}
            disabled={pendente}
            placeholder="#hashtag1 #hashtag2"
            className="mt-1 w-full rounded border border-bd/15 bg-surface/60 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={cancelar}
              disabled={pendente}
              className="rounded-md px-2 py-1 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40"
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

const SUGESTOES_RAPIDAS = [
  'Mais direto e curto',
  'Mais formal / institucional',
  'Mais casual / conversacional',
  'Adiciona um gancho mais forte no começo',
  'Adiciona chamada pra ação (CTA) sutil no fim',
  'Menciona o cliente pelo nome',
];

function AjustarCopyIA({
  pageId,
  pendente,
  onSucesso,
}: {
  pageId: string;
  pendente: boolean;
  onSucesso: (novoPlano: import('@/src/types').PlanoPublicacao) => void;
}) {
  const [instrucao, setInstrucao] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function enviar() {
    const texto = instrucao.trim();
    if (texto.length < 3) {
      setErro('Escreva o que quer ajustar (mínimo 3 caracteres).');
      return;
    }
    setProcessando(true);
    setErro(null);
    setOkMsg(null);
    try {
      const resp = await fetch(`/api/posts/${pageId}/ajustar-copy`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ instrucao: texto }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        plano?: import('@/src/types').PlanoPublicacao;
      };
      if (!resp.ok || data.error || !data.plano) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      onSucesso(data.plano);
      setInstrucao('');
      setOkMsg('Legenda atualizada. Rola pra cima pra ver a nova versão em cada rede.');
      setTimeout(() => setOkMsg(null), 6000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="rounded-lg border border-primary/25 bg-primary/[0.04] p-3">
      <p className="mb-2 text-xs text-fg-muted">
        Descreva o que quer mudar na legenda (aplica em todas as redes de uma vez).
      </p>
      <textarea
        value={instrucao}
        onChange={(e) => setInstrucao(e.target.value)}
        disabled={processando || pendente}
        rows={3}
        placeholder="Ex: mais direto, menos formal, adiciona CTA no fim, menciona a marca X..."
        className="w-full resize-y rounded border border-bd/50 bg-surface/60 p-2 text-sm text-fg placeholder:text-fg-muted/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />

      <div className="mt-2 flex flex-wrap gap-1">
        {SUGESTOES_RAPIDAS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setInstrucao((v) => (v.trim() ? `${v.trim()}. ${s}` : s))}
            disabled={processando || pendente}
            className="rounded-full border border-bd/40 bg-surface/40 px-2 py-0.5 text-[10px] text-fg-muted hover:border-primary/40 hover:text-fg disabled:opacity-40"
          >
            + {s}
          </button>
        ))}
      </div>

      {erro && <p className="mt-2 text-xs text-error">Erro: {erro}</p>}
      {okMsg && !erro && <p className="mt-2 text-xs text-success">{okMsg}</p>}

      <div className="mt-3 flex justify-end">
        <button
          onClick={enviar}
          disabled={processando || pendente || instrucao.trim().length < 3}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-app transition-colors hover:bg-primary/85 disabled:opacity-40"
        >
          {processando ? 'Reescrevendo…' : '✨ Reescrever com IA'}
        </button>
      </div>
    </div>
  );
}
