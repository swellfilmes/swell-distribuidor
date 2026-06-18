'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Etapa =
  | { tipo: 'idle' }
  | { tipo: 'subindo'; pct: number; nome: string }
  | { tipo: 'enfileirado'; jobId: number; nome: string }
  | { tipo: 'processando'; jobId: number; nome: string; logs: string[] }
  | {
      tipo: 'concluido';
      jobId: number;
      nome: string;
      resultado: { pageId: string; notionUrl: string; cliente: string; tipo: string };
      logs: string[];
    }
  | { tipo: 'erro'; jobId?: number; nome?: string; erro: string };

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

export function Uploader() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'idle' });
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function abrirSeletor() {
    inputRef.current?.click();
  }

  async function subir(arquivo: File) {
    setEtapa({ tipo: 'subindo', pct: 0, nome: arquivo.name });

    // 1) Pega URL assinada
    let presign: { url: string; chaveR2: string; urlPublica: string };
    try {
      const resp = await fetch('/api/upload/url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nomeArquivo: arquivo.name,
          contentType: arquivo.type || 'video/mp4',
        }),
      });
      if (!resp.ok) {
        const d = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `HTTP ${resp.status} na URL assinada`);
      }
      presign = (await resp.json()) as typeof presign;
    } catch (err) {
      setEtapa({
        tipo: 'erro',
        nome: arquivo.name,
        erro: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // 2) PUT no R2 com XHR pra acompanhar progresso
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presign.url);
        xhr.setRequestHeader('content-type', arquivo.type || 'video/mp4');
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setEtapa({ tipo: 'subindo', pct, nome: arquivo.name });
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
      setEtapa({
        tipo: 'erro',
        nome: arquivo.name,
        erro: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // 3) Cria job
    let jobId: number;
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
          },
        }),
      });
      if (!resp.ok) {
        const d = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `HTTP ${resp.status} criando job`);
      }
      const data = (await resp.json()) as { id: number };
      jobId = data.id;
    } catch (err) {
      setEtapa({
        tipo: 'erro',
        nome: arquivo.name,
        erro: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    setEtapa({ tipo: 'enfileirado', jobId, nome: arquivo.name });
  }

  // Poll de status quando temos jobId
  useEffect(() => {
    if (etapa.tipo !== 'enfileirado' && etapa.tipo !== 'processando') return;
    const jobId = etapa.jobId;
    const nome = etapa.nome;
    let cancelado = false;

    const tick = async () => {
      if (cancelado) return;
      try {
        const resp = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as { job: Job };
        const j = data.job;
        if (cancelado) return;
        if (j.status === 'pending') {
          setEtapa({ tipo: 'enfileirado', jobId, nome });
        } else if (j.status === 'in_progress') {
          setEtapa({
            tipo: 'processando',
            jobId,
            nome,
            logs: (j.result?.logs as string[] | undefined) ?? [],
          });
        } else if (j.status === 'done' && j.result) {
          setEtapa({
            tipo: 'concluido',
            jobId,
            nome,
            resultado: {
              pageId: j.result.pageId,
              notionUrl: j.result.notionUrl,
              cliente: j.result.cliente,
              tipo: j.result.tipo,
            },
            logs: j.result.logs ?? [],
          });
          // Avisa a tabela pra refrescar quando o usuário voltar
          router.refresh();
        } else if (j.status === 'failed') {
          setEtapa({
            tipo: 'erro',
            jobId,
            nome,
            erro: j.erro ?? 'falhou (sem detalhes)',
          });
        }
      } catch (err) {
        if (cancelado) return;
        setEtapa({
          tipo: 'erro',
          jobId,
          nome,
          erro: err instanceof Error ? err.message : String(err),
        });
      }
    };

    tick();
    const id = setInterval(tick, 3_000);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [etapa, router]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) subir(f);
  }

  function novoUpload() {
    setEtapa({ tipo: 'idle' });
  }

  return (
    <div>
      {etapa.tipo === 'idle' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={abrirSeletor}
          className={
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-16 text-center transition-colors ' +
            (drag
              ? 'border-ink bg-ink/5'
              : 'border-ink/20 bg-white hover:border-ink/40')
          }
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mb-3 text-ink/40">
            <path
              d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-base font-medium text-ink/85">
            Arrasta o vídeo aqui ou clica pra escolher
          </p>
          <p className="mt-1 text-xs text-ink/55">
            MP4 / MOV / WEBM — sobe direto no R2 da Swell
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) subir(f);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {etapa.tipo === 'subindo' && (
        <Cartao titulo={`Subindo no R2 — ${etapa.nome}`}>
          <Barra pct={etapa.pct} />
          <p className="mt-2 text-xs text-ink/60">{etapa.pct}%</p>
        </Cartao>
      )}

      {etapa.tipo === 'enfileirado' && (
        <Cartao titulo={`Enfileirado — ${etapa.nome}`}>
          <p className="text-sm text-ink/70">
            Aguardando worker pegar o job (#{etapa.jobId})…
          </p>
          <AvisoWorker />
        </Cartao>
      )}

      {etapa.tipo === 'processando' && (
        <Cartao titulo={`Processando — ${etapa.nome}`}>
          <p className="text-sm text-ink/70">
            Worker rodando (job #{etapa.jobId}). Costuma levar 30-90s.
          </p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded bg-ink/10">
            <div className="h-full w-1/3 animate-pulse bg-ink/60" />
          </div>
        </Cartao>
      )}

      {etapa.tipo === 'concluido' && (
        <Cartao titulo={`✅ Pronto — ${etapa.nome}`} sucesso>
          <dl className="mt-2 grid grid-cols-[100px_1fr] gap-y-1 text-sm">
            <dt className="text-ink/60">Cliente</dt>
            <dd>{etapa.resultado.cliente}</dd>
            <dt className="text-ink/60">Tipo</dt>
            <dd>{etapa.resultado.tipo}</dd>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/app/posts"
              className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:opacity-90"
            >
              Ver na tabela ↓
            </a>
            <a
              href={etapa.resultado.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-ink/20 px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-ink/5"
            >
              Abrir no Notion ↗
            </a>
            <button
              onClick={novoUpload}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5"
            >
              Subir outro
            </button>
          </div>
        </Cartao>
      )}

      {etapa.tipo === 'erro' && (
        <Cartao titulo="❌ Erro" erro>
          <p className="text-sm text-rose-800">{etapa.erro}</p>
          <button
            onClick={novoUpload}
            className="mt-3 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            Tentar de novo
          </button>
        </Cartao>
      )}
    </div>
  );
}

function Cartao({
  titulo,
  children,
  sucesso = false,
  erro = false,
}: {
  titulo: string;
  children: React.ReactNode;
  sucesso?: boolean;
  erro?: boolean;
}) {
  const borda = sucesso
    ? 'border-emerald-200 bg-emerald-50'
    : erro
    ? 'border-rose-200 bg-rose-50'
    : 'border-ink/15 bg-white';
  return (
    <div className={`rounded-lg border p-5 ${borda}`}>
      <h2 className="mb-2 text-base font-semibold">{titulo}</h2>
      {children}
    </div>
  );
}

function Barra({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-ink/10">
      <div
        className="h-full bg-ink transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function AvisoWorker() {
  return (
    <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      💡 Lembra: o worker precisa estar rodando em outro terminal —{' '}
      <code className="rounded bg-white px-1">npm run worker</code>. Senão o
      job fica enfileirado pra sempre. Na F2.6 isso vai pro Railway e não vai
      precisar mais disso.
    </p>
  );
}
