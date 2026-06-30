'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_CONCORRENTES = 2;
// Cap 5GB cobre vídeos longos pro YouTube. R2 PUT aguenta até 5TB single-shot.
// Pra vídeos >500MB avisamos no UI sobre limites das outras redes (TikTok ~287MB,
// Instagram Reels 4GB) — o cérebro depois filtra automaticamente as redes
// que não vão aceitar aquele tamanho.
const TAMANHO_MAX_BYTES = 5 * 1024 * 1024 * 1024;
const TAMANHO_AVISO_BYTES = 500 * 1024 * 1024;
const POLLING_TIMEOUT_MS = 20 * 60 * 1000; // 20 min — vídeo grande pode demorar mais no worker

type Etapa =
  | { tipo: 'fila'; pct: 0 }
  | { tipo: 'subindo'; pct: number }
  | { tipo: 'enfileirado'; jobId: number }
  | { tipo: 'processando'; jobId: number; logs: string[] }
  | {
      tipo: 'concluido';
      jobId: number;
      resultado: { pageId: string; notionUrl: string; cliente: string; tipo: string };
      logs: string[];
    }
  | { tipo: 'erro'; jobId?: number; erro: string };

interface ItemUpload {
  key: string;
  arquivo: File;
  /** Carrossel: imagens extras que serão postadas junto. Vazio/undefined pra single. */
  extras?: File[];
  etapa: Etapa;
}

function ehImagemFile(arquivo: File): boolean {
  return mimeFallback(arquivo).startsWith('image/');
}

interface Job {
  id: number;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  erro: string | null;
  result: {
    pageId: string;
    notionUrl: string;
    cliente: string;
    tipo: string;
    logs?: string[];
  } | null;
}

function chaveArquivo(arquivo: File): string {
  return `${arquivo.name}::${arquivo.size}::${arquivo.lastModified}`;
}

/** Deduz MIME por extensão quando o browser não sabe (raro, mas acontece). */
function mimeFallback(arquivo: File): string {
  if (arquivo.type) return arquivo.type;
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith('.png')) return 'image/png';
  if (nome.endsWith('.webp')) return 'image/webp';
  if (nome.endsWith('.jpg') || nome.endsWith('.jpeg')) return 'image/jpeg';
  if (nome.endsWith('.mov')) return 'video/quicktime';
  if (nome.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}

function ehMidia(arquivo: File): boolean {
  const t = mimeFallback(arquivo);
  return t.startsWith('video/') || t.startsWith('image/');
}

export function Uploader() {
  const router = useRouter();
  const [itens, setItens] = useState<ItemUpload[]>([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const itensRef = useRef<ItemUpload[]>([]);
  itensRef.current = itens;

  function patchItem(key: string, patch: (it: ItemUpload) => ItemUpload) {
    setItens((atuais) =>
      atuais.map((it) => (it.key === key ? patch(it) : it)),
    );
  }

  async function subir(item: ItemUpload) {
    const { key, arquivo } = item;
    patchItem(key, (it) => ({ ...it, etapa: { tipo: 'subindo', pct: 0 } }));

    let presign: { url: string; chaveR2: string; urlPublica: string; dedupeKey: string };
    try {
      const resp = await fetch('/api/upload/url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nomeArquivo: arquivo.name,
          contentType: mimeFallback(arquivo),
          tamanhoBytes: arquivo.size,
          lastModified: arquivo.lastModified,
        }),
      });
      if (!resp.ok) {
        const d = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `HTTP ${resp.status} na URL assinada`);
      }
      const data = (await resp.json()) as
        | (typeof presign & { duplicate?: false })
        | { duplicate: true; jobId: number; status: string; mensagem: string };
      if ('duplicate' in data && data.duplicate) {
        patchItem(key, (it) => ({
          ...it,
          etapa: { tipo: 'enfileirado', jobId: data.jobId },
        }));
        return;
      }
      presign = data as typeof presign;
    } catch (err) {
      patchItem(key, (it) => ({
        ...it,
        etapa: {
          tipo: 'erro',
          erro: err instanceof Error ? err.message : String(err),
        },
      }));
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presign.url);
        xhr.setRequestHeader('content-type', mimeFallback(arquivo));
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            patchItem(key, (it) => ({ ...it, etapa: { tipo: 'subindo', pct } }));
          }
        });
        xhr.addEventListener('load', () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`R2 retornou ${xhr.status}`)),
        );
        xhr.addEventListener('error', () =>
          reject(new Error('Erro de rede subindo no R2.')),
        );
        xhr.send(arquivo);
      });
    } catch (err) {
      patchItem(key, (it) => ({
        ...it,
        etapa: {
          tipo: 'erro',
          erro: err instanceof Error ? err.message : String(err),
        },
      }));
      return;
    }

    // Carrossel: sobe extras em paralelo. Falha de qualquer um aborta o job.
    const extrasUploaded: Array<{ chaveR2: string; urlPublica: string; nomeArquivo: string }> = [];
    if (item.extras && item.extras.length > 0) {
      try {
        const presigns = await Promise.all(
          item.extras.map(async (ex) => {
            const r = await fetch('/api/upload/url', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                nomeArquivo: ex.name,
                contentType: mimeFallback(ex),
                tamanhoBytes: ex.size,
                lastModified: ex.lastModified,
              }),
            });
            if (!r.ok) {
              const d = (await r.json().catch(() => ({}))) as { error?: string };
              throw new Error(d.error ?? `presign extra ${ex.name}`);
            }
            return (await r.json()) as { url: string; chaveR2: string; urlPublica: string };
          }),
        );
        await Promise.all(
          item.extras.map((ex, i) =>
            new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('PUT', presigns[i].url);
              xhr.setRequestHeader('content-type', mimeFallback(ex));
              xhr.addEventListener('load', () =>
                xhr.status >= 200 && xhr.status < 300
                  ? resolve()
                  : reject(new Error(`R2 retornou ${xhr.status} pra ${ex.name}`)),
              );
              xhr.addEventListener('error', () =>
                reject(new Error(`Erro de rede subindo ${ex.name} no R2.`)),
              );
              xhr.send(ex);
            }),
          ),
        );
        for (let i = 0; i < item.extras.length; i++) {
          extrasUploaded.push({
            chaveR2: presigns[i].chaveR2,
            urlPublica: presigns[i].urlPublica,
            nomeArquivo: item.extras[i].name,
          });
        }
      } catch (err) {
        patchItem(key, (it) => ({
          ...it,
          etapa: {
            tipo: 'erro',
            erro: err instanceof Error ? err.message : String(err),
          },
        }));
        return;
      }
    }

    try {
      const resp = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tipo: 'ingest',
          payload: {
            chaveR2: presign.chaveR2,
            urlPublica: presign.urlPublica,
            nomeArquivo: arquivo.name,
            tamanhoBytes: arquivo.size,
            dedupeKey: presign.dedupeKey,
            ...(extrasUploaded.length > 0 ? { extras: extrasUploaded } : {}),
          },
        }),
      });
      if (!resp.ok) {
        const d = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `HTTP ${resp.status} criando job`);
      }
      const data = (await resp.json()) as { id: number };
      patchItem(key, (it) => ({
        ...it,
        etapa: { tipo: 'enfileirado', jobId: data.id },
      }));
    } catch (err) {
      patchItem(key, (it) => ({
        ...it,
        etapa: {
          tipo: 'erro',
          erro: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  }

  function adicionarArquivos(arquivos: FileList | File[]) {
    const lista = Array.from(arquivos).filter(ehMidia);
    const fmtTam = (b: number) =>
      b >= 1024 * 1024 * 1024
        ? `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`
        : `${(b / 1024 / 1024).toFixed(0)} MB`;

    // Bloqueia arquivos acima de 5GB (limite YouTube ainda OK).
    const grandes = lista.filter((a) => a.size > TAMANHO_MAX_BYTES);
    if (grandes.length > 0) {
      const nomes = grandes.map((a) => `${a.name} (${fmtTam(a.size)})`).join(', ');
      alert(
        `Arquivo(s) acima de ${fmtTam(TAMANHO_MAX_BYTES)} foram ignorados:\n\n${nomes}\n\nMáximo: 5 GB. Comprima antes (Handbrake, ffmpeg) ou divida em partes.`,
      );
    }
    const aceitos = lista.filter((a) => a.size <= TAMANHO_MAX_BYTES);

    // Aviso pra vídeos > 500MB: cérebro vai filtrar redes que não aceitam
    // aquele tamanho. Só informativo, não bloqueia.
    const enormes = aceitos.filter((a) => a.size > TAMANHO_AVISO_BYTES && !ehImagemFile(a));
    if (enormes.length > 0) {
      const nomes = enormes.map((a) => `${a.name} (${fmtTam(a.size)})`).join(', ');
      const aviso =
        `Vídeo(s) grande(s):\n${nomes}\n\n` +
        `Limites por rede:\n` +
        `• TikTok: até 287 MB\n` +
        `• Instagram Reels: até 4 GB\n` +
        `• YouTube: até 5 GB (até 256 GB pra conta verificada)\n\n` +
        `A IA vai filtrar automaticamente as redes que não aceitam esse tamanho.`;
      // eslint-disable-next-line no-console
      console.info(aviso);
      // Sem alert pra não interromper; o aviso fica no card do item depois.
    }
    const existentes = new Set(itensRef.current.map((it) => it.key));

    // Separa em imagens vs vídeos. Imagens dropped no mesmo batch agrupam
    // como UM carrossel (se >=2). Vídeos sempre viram itens individuais.
    const imagens: File[] = [];
    const novos: ItemUpload[] = [];
    for (const arquivo of aceitos) {
      if (ehImagemFile(arquivo)) {
        imagens.push(arquivo);
      } else {
        const key = chaveArquivo(arquivo);
        if (existentes.has(key)) continue;
        existentes.add(key);
        novos.push({ key, arquivo, etapa: { tipo: 'fila', pct: 0 } });
      }
    }

    if (imagens.length >= 2) {
      // Agrupa todas as imagens dropped juntas como 1 carrossel.
      const principal = imagens[0];
      const extras = imagens.slice(1);
      const key = `carrossel::${chaveArquivo(principal)}::${extras.length}`;
      if (!existentes.has(key)) {
        novos.push({ key, arquivo: principal, extras, etapa: { tipo: 'fila', pct: 0 } });
      }
    } else if (imagens.length === 1) {
      const key = chaveArquivo(imagens[0]);
      if (!existentes.has(key)) {
        novos.push({ key, arquivo: imagens[0], etapa: { tipo: 'fila', pct: 0 } });
      }
    }

    if (novos.length === 0) return;
    setItens((atuais) => [...atuais, ...novos]);
  }

  // Despacho: enquanto houver vagas (< MAX_CONCORRENTES subindo) e itens na fila, dispara.
  useEffect(() => {
    const subindoAgora = itens.filter((it) => it.etapa.tipo === 'subindo').length;
    const vagas = MAX_CONCORRENTES - subindoAgora;
    if (vagas <= 0) return;
    const naFila = itens.filter((it) => it.etapa.tipo === 'fila').slice(0, vagas);
    for (const it of naFila) {
      // Marca como "subindo" otimisticamente pra outra render não re-disparar.
      patchItem(it.key, (cur) => ({ ...cur, etapa: { tipo: 'subindo', pct: 0 } }));
      void subir(it);
    }
  }, [itens]);

  // Polling pra jobs em enfileirado/processando.
  const jobIdsAtivos = useMemo(
    () =>
      itens
        .filter(
          (it) =>
            it.etapa.tipo === 'enfileirado' || it.etapa.tipo === 'processando',
        )
        .map((it) =>
          it.etapa.tipo === 'enfileirado' || it.etapa.tipo === 'processando'
            ? { key: it.key, jobId: it.etapa.jobId }
            : null,
        )
        .filter((x): x is { key: string; jobId: number } => x !== null),
    [itens],
  );

  useEffect(() => {
    if (jobIdsAtivos.length === 0) return;
    let cancelado = false;
    const inicioPolling = new Map<string, number>();
    for (const { key } of jobIdsAtivos) {
      if (!inicioPolling.has(key)) inicioPolling.set(key, Date.now());
    }

    const tick = async () => {
      if (cancelado) return;
      await Promise.all(
        jobIdsAtivos.map(async ({ key, jobId }) => {
          // Timeout client-side: se job ficou >10min sem virar done/failed,
          // marca como erro pra testador não esperar pra sempre.
          const inicio = inicioPolling.get(key) ?? Date.now();
          if (Date.now() - inicio > POLLING_TIMEOUT_MS) {
            patchItem(key, (it) =>
              it.etapa.tipo === 'concluido' || it.etapa.tipo === 'erro'
                ? it
                : {
                    ...it,
                    etapa: {
                      tipo: 'erro',
                      jobId,
                      erro: 'Demorou demais (>10min). O worker pode ter caído. Verifica o Railway ou tenta de novo.',
                    },
                  },
            );
            return;
          }
          try {
            const resp = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' });
            if (!resp.ok) return;
            const data = (await resp.json()) as { job: Job };
            if (cancelado) return;
            const j = data.job;
            if (j.status === 'in_progress') {
              patchItem(key, (it) => ({
                ...it,
                etapa: {
                  tipo: 'processando',
                  jobId,
                  logs: (j.result?.logs as string[] | undefined) ?? [],
                },
              }));
            } else if (j.status === 'done' && j.result) {
              patchItem(key, (it) => ({
                ...it,
                etapa: {
                  tipo: 'concluido',
                  jobId,
                  resultado: {
                    pageId: j.result!.pageId,
                    notionUrl: j.result!.notionUrl,
                    cliente: j.result!.cliente,
                    tipo: j.result!.tipo,
                  },
                  logs: j.result!.logs ?? [],
                },
              }));
              router.refresh();
            } else if (j.status === 'failed') {
              patchItem(key, (it) => ({
                ...it,
                etapa: {
                  tipo: 'erro',
                  jobId,
                  erro: j.erro ?? 'falhou (sem detalhes)',
                },
              }));
            }
          } catch {
            // Falha de polling não estoura o item; tenta de novo no próximo tick.
          }
        }),
      );
    };

    tick();
    const id = setInterval(tick, 3_000);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [jobIdsAtivos, router]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files) adicionarArquivos(e.dataTransfer.files);
  }

  function limparConcluidos() {
    setItens((atuais) =>
      atuais.filter(
        (it) => it.etapa.tipo !== 'concluido' && it.etapa.tipo !== 'erro',
      ),
    );
  }

  function removerItem(key: string) {
    setItens((atuais) => atuais.filter((it) => it.key !== key));
  }

  const temAtividade = itens.some(
    (it) =>
      it.etapa.tipo === 'fila' ||
      it.etapa.tipo === 'subindo' ||
      it.etapa.tipo === 'enfileirado' ||
      it.etapa.tipo === 'processando',
  );
  const temFinalizado = itens.some(
    (it) => it.etapa.tipo === 'concluido' || it.etapa.tipo === 'erro',
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ' +
          (drag
            ? 'border-bd bg-primary/5'
            : 'border-bd/20 bg-surface hover:border-bd/40')
        }
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mb-3 text-fg-muted/40">
          <path
            d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <p className="text-base font-medium text-fg-muted/85">
          Arrasta vídeos ou fotos aqui ou clica pra escolher
        </p>
        <p className="mt-1 text-xs text-fg-muted/55">
          MP4 / MOV / WEBM até 5 GB · JPG / PNG / WEBP — máx. {MAX_CONCORRENTES} subindo ao mesmo tempo
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) adicionarArquivos(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {itens.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-fg-muted/70">
              {itens.length} arquivo{itens.length === 1 ? '' : 's'}
              {temAtividade ? ' — processando…' : ''}
            </h2>
            {temFinalizado && (
              <button
                onClick={limparConcluidos}
                className="text-xs font-medium text-fg-muted/60 hover:text-fg-muted/90"
              >
                Limpar concluídos
              </button>
            )}
          </div>

          {itens.map((it) => (
            <ItemCard key={it.key} item={it} onRemover={() => removerItem(it.key)} />
          ))}
        </div>
      )}

      {itens.length > 0 && temAtividade && (
        <AvisoWorker />
      )}
    </div>
  );
}

function ItemCard({
  item,
  onRemover,
}: {
  item: ItemUpload;
  onRemover: () => void;
}) {
  const { arquivo, extras, etapa } = item;
  const ehCarrossel = (extras?.length ?? 0) > 0;
  const todosOsArquivos = ehCarrossel ? [arquivo, ...(extras as File[])] : [arquivo];
  const tamanhoTotalMB =
    todosOsArquivos.reduce((soma, a) => soma + a.size, 0) / 1024 / 1024;
  const sucesso = etapa.tipo === 'concluido';
  const erro = etapa.tipo === 'erro';
  const borda = sucesso
    ? 'border-success/30 bg-success/10'
    : erro
    ? 'border-error/30 bg-error/10'
    : 'border-bd/15 bg-surface';

  const podeRemover =
    etapa.tipo === 'fila' || etapa.tipo === 'concluido' || etapa.tipo === 'erro';

  return (
    <div className={`rounded-lg border p-4 ${borda}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {ehCarrossel ? (
            <>
              <p className="flex items-center gap-1.5 text-sm font-medium text-fg-muted/85">
                <span>🎠 Carrossel</span>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-fg-muted/70">
                  {todosOsArquivos.length} imagens
                </span>
              </p>
              <p className="mt-0.5 truncate text-xs text-fg-muted/55">
                {todosOsArquivos.map((a) => a.name).join(', ')}
              </p>
              <p className="mt-0.5 text-xs text-fg-muted/55">
                {tamanhoTotalMB.toFixed(1)} MB total
              </p>
            </>
          ) : (
            <>
              <p className="truncate text-sm font-medium text-fg-muted/85">{arquivo.name}</p>
              <p className="mt-0.5 text-xs text-fg-muted/55">
                {tamanhoTotalMB.toFixed(1)} MB
              </p>
            </>
          )}
        </div>
        {podeRemover && (
          <button
            onClick={onRemover}
            className="text-xs text-fg-muted/50 hover:text-fg-muted/80"
            title="Remover"
          >
            ✕
          </button>
        )}
      </div>

      <div className="mt-2">
        {etapa.tipo === 'fila' && (
          <p className="text-xs text-fg-muted/60">Na fila…</p>
        )}
        {etapa.tipo === 'subindo' && (
          <>
            <Barra pct={etapa.pct} />
            <p className="mt-1 text-xs text-fg-muted/60">Subindo no R2 — {etapa.pct}%</p>
          </>
        )}
        {etapa.tipo === 'enfileirado' && (
          <p className="text-xs text-fg-muted/60">
            Enfileirado (job #{etapa.jobId}) — aguardando worker…
          </p>
        )}
        {etapa.tipo === 'processando' && (
          <>
            <div className="h-1 w-full overflow-hidden rounded bg-primary/10">
              <div className="h-full w-1/3 animate-pulse bg-primary/60" />
            </div>
            <p className="mt-1 text-xs text-fg-muted/60">
              Worker processando (job #{etapa.jobId})…
            </p>
          </>
        )}
        {etapa.tipo === 'concluido' && (
          <div className="space-y-2">
            <dl className="grid grid-cols-[80px_1fr] gap-y-0.5 text-xs">
              <dt className="text-fg-muted/55">Cliente</dt>
              <dd>{etapa.resultado.cliente}</dd>
              <dt className="text-fg-muted/55">Tipo</dt>
              <dd>{etapa.resultado.tipo}</dd>
            </dl>
            <a
              href={etapa.resultado.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-medium text-success underline hover:text-emerald-950"
            >
              Abrir no Notion ↗
            </a>
          </div>
        )}
        {etapa.tipo === 'erro' && (
          <p className="text-xs text-error">❌ {etapa.erro}</p>
        )}
      </div>
    </div>
  );
}

function Barra({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-primary/10">
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function AvisoWorker() {
  return (
    <p className="mt-4 rounded border border-primary/30 bg-primary/8 px-3 py-2 text-xs text-fg">
      💡 O worker do Railway pega os jobs em paralelo. Se algum ficar parado em
      &ldquo;enfileirado&rdquo; por mais de 1min, dá uma olhada no painel do
      Railway.
    </p>
  );
}
