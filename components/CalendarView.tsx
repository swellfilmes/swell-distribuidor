'use client';

import { useMemo, useState } from 'react';
import { StatusBadge, RedeBadge } from './StatusBadge';
import type { PostListado } from '@/lib-web/notionData';

interface Props {
  posts: PostListado[];
  mes: string; // 'YYYY-MM'
  onMesChange: (mes: string) => void;
  onSelecionar: (post: PostListado) => void;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function parseMes(mes: string): { ano: number; mesNum: number } {
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) {
    const hoje = new Date();
    return { ano: hoje.getFullYear(), mesNum: hoje.getMonth() + 1 };
  }
  return { ano: parseInt(m[1], 10), mesNum: parseInt(m[2], 10) };
}

function fmtMes(ano: number, mesNum: number): string {
  return `${ano}-${String(mesNum).padStart(2, '0')}`;
}

function nomeMes(ano: number, mesNum: number): string {
  const data = new Date(ano, mesNum - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(data);
}

function diaIsoDoPost(p: PostListado): string | null {
  const iso = p.dataPublicacao ?? p.publicadoEm;
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function horaCurta(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

export function CalendarView({ posts, mes, onMesChange, onSelecionar }: Props) {
  const { ano, mesNum } = parseMes(mes);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

  // Agrupa posts por dia
  const postsPorDia = useMemo(() => {
    const mapa = new Map<string, PostListado[]>();
    for (const p of posts) {
      const dia = diaIsoDoPost(p);
      if (!dia) continue;
      if (!mapa.has(dia)) mapa.set(dia, []);
      mapa.get(dia)!.push(p);
    }
    // Ordena cada dia por hora
    for (const arr of mapa.values()) {
      arr.sort((a, b) => {
        const ha = (a.dataPublicacao ?? a.publicadoEm ?? '').localeCompare(
          b.dataPublicacao ?? b.publicadoEm ?? '',
        );
        return ha;
      });
    }
    return mapa;
  }, [posts]);

  // Constrói grid: começa no domingo da primeira semana do mês
  const primeiroDiaMes = new Date(ano, mesNum - 1, 1);
  const ultimoDiaMes = new Date(ano, mesNum, 0);
  const inicioGrid = new Date(primeiroDiaMes);
  inicioGrid.setDate(inicioGrid.getDate() - inicioGrid.getDay());
  const fimGrid = new Date(ultimoDiaMes);
  const sobraFim = 6 - fimGrid.getDay();
  if (sobraFim > 0) fimGrid.setDate(fimGrid.getDate() + sobraFim);

  const dias: Date[] = [];
  for (let d = new Date(inicioGrid); d <= fimGrid; d.setDate(d.getDate() + 1)) {
    dias.push(new Date(d));
  }

  const hojeIso = new Date().toISOString().slice(0, 10);

  function isoDoDia(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function mesAnterior() {
    const novo = new Date(ano, mesNum - 2, 1);
    onMesChange(fmtMes(novo.getFullYear(), novo.getMonth() + 1));
  }

  function proxMes() {
    const novo = new Date(ano, mesNum, 1);
    onMesChange(fmtMes(novo.getFullYear(), novo.getMonth() + 1));
  }

  function hojeMes() {
    const h = new Date();
    onMesChange(fmtMes(h.getFullYear(), h.getMonth() + 1));
  }

  const postsDoDiaAberto = diaAberto ? postsPorDia.get(diaAberto) ?? [] : [];

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={mesAnterior}
            className="rounded-md border border-bd/15 px-2 py-1 text-sm text-fg-muted/80 hover:bg-primary/5"
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <h2 className="min-w-[180px] text-center text-base font-medium capitalize">
            {nomeMes(ano, mesNum)}
          </h2>
          <button
            onClick={proxMes}
            className="rounded-md border border-bd/15 px-2 py-1 text-sm text-fg-muted/80 hover:bg-primary/5"
            aria-label="Próximo mês"
          >
            ›
          </button>
          <button
            onClick={hojeMes}
            className="ml-2 rounded-md border border-bd/15 px-2 py-1 text-xs text-fg-muted/70 hover:bg-primary/5"
          >
            Hoje
          </button>
        </div>
        <p className="text-xs text-fg-muted/55">
          {posts.length} post(s) no período visível
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-bd/10 bg-surface">
        <div className="grid grid-cols-7 border-b border-bd/10 bg-primary/[0.02] text-center text-xs uppercase tracking-wide text-fg-muted/55">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((d) => {
            const iso = isoDoDia(d);
            const noMes = d.getMonth() === mesNum - 1;
            const ehHoje = iso === hojeIso;
            const lista = postsPorDia.get(iso) ?? [];
            const visiveis = lista.slice(0, 3);
            const sobra = lista.length - visiveis.length;
            return (
              <div
                key={iso}
                className={
                  'min-h-[110px] border-b border-r border-bd/5 p-1.5 ' +
                  (noMes ? 'bg-surface' : 'bg-primary/[0.015] text-fg-muted/40')
                }
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ' +
                      (ehHoje ? 'bg-primary font-medium text-app' : 'text-fg-muted/60')
                    }
                  >
                    {d.getDate()}
                  </span>
                  {lista.length > 0 && noMes && (
                    <span className="text-[10px] text-fg-muted/40">
                      {lista.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {visiveis.map((p) => (
                    <button
                      key={p.pageId}
                      onClick={() => onSelecionar(p)}
                      title={`${horaCurta(p.dataPublicacao ?? p.publicadoEm)} · ${p.nome}`}
                      className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] leading-tight transition hover:bg-primary/5"
                    >
                      <span className="font-medium text-fg-muted/70">
                        {horaCurta(p.dataPublicacao ?? p.publicadoEm)}
                      </span>{' '}
                      <span className="text-fg-muted/75">{p.cliente || p.tipo}</span>
                    </button>
                  ))}
                  {sobra > 0 && (
                    <button
                      onClick={() => setDiaAberto(iso)}
                      className="block w-full rounded px-1.5 py-0.5 text-left text-[10px] text-fg-muted/55 hover:bg-primary/5"
                    >
                      +{sobra} mais
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {diaAberto && (
        <div className="fixed inset-0 z-30" onClick={() => setDiaAberto(null)}>
          <div className="absolute inset-0 bg-primary/30 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-1/2 top-1/2 max-h-[80vh] w-[min(560px,90vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-bd/10 bg-app shadow-xl"
          >
            <header className="flex items-center justify-between border-b border-bd/10 px-4 py-3">
              <h3 className="font-medium">
                {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(
                  new Date(`${diaAberto}T00:00:00`),
                )}
              </h3>
              <button
                onClick={() => setDiaAberto(null)}
                className="text-fg-muted/60 hover:text-fg"
              >
                ✕
              </button>
            </header>
            <ul className="max-h-[60vh] divide-y divide-ink/5 overflow-y-auto">
              {postsDoDiaAberto.map((p) => (
                <li key={p.pageId}>
                  <button
                    onClick={() => {
                      onSelecionar(p);
                      setDiaAberto(null);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-primary/5"
                  >
                    {p.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnailUrl}
                        alt=""
                        className="h-12 w-14 shrink-0 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-fg-muted/70">
                          {horaCurta(p.dataPublicacao ?? p.publicadoEm)}
                        </span>
                        <StatusBadge status={p.status} />
                        {p.redes.map((r) => (
                          <RedeBadge key={r} rede={r} />
                        ))}
                      </div>
                      <p className="mt-1 truncate text-sm">{p.nome}</p>
                      <p className="text-[11px] text-fg-muted/55">
                        {p.cliente} · {p.tipo}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
