'use client';

import { useMemo, useState } from 'react';
import { StatusBadge, StatusDot, RedeBadge } from './StatusBadge';
import { labelDoStatus, type PostListado } from '@/lib-web/notionData';

interface Props {
  posts: PostListado[];
  mes: string; // 'YYYY-MM'
  onMesChange: (mes: string) => void;
  onSelecionar: (post: PostListado) => void;
  /**
   * Drag-and-drop: usuário arrasta o tile de um post pra outro dia.
   * Backend deve preservar a hora do dia original quando vier preenchida.
   * Quando undefined, drag-and-drop desabilita.
   */
  onMoverPost?: (pageId: string, novoDiaIso: string) => void;
  /** Conjunto de pageIds com PATCH pendente — usado pra mostrar feedback. */
  pendentes?: Set<string>;
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

export function CalendarView({
  posts,
  mes,
  onMesChange,
  onSelecionar,
  onMoverPost,
  pendentes,
}: Props) {
  const { ano, mesNum } = parseMes(mes);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [diaOver, setDiaOver] = useState<string | null>(null);
  const dragHabilitado = Boolean(onMoverPost);

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

  function handleDragStart(e: React.DragEvent, pageId: string, diaOrigem: string) {
    if (!dragHabilitado) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pageId);
    // Custom data pro caso de browser não respeitar text/plain
    e.dataTransfer.setData('application/x-post-id', pageId);
    e.dataTransfer.setData('application/x-dia-origem', diaOrigem);
    setArrastandoId(pageId);
  }

  function handleDragEnd() {
    setArrastandoId(null);
    setDiaOver(null);
  }

  function handleDragOver(e: React.DragEvent, diaIso: string) {
    if (!dragHabilitado || !arrastandoId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (diaOver !== diaIso) setDiaOver(diaIso);
  }

  function handleDragLeave(e: React.DragEvent, diaIso: string) {
    // Só limpa se realmente saiu da célula (não filhos internos)
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) return;
    if (diaOver === diaIso) setDiaOver(null);
  }

  function handleDrop(e: React.DragEvent, diaIso: string) {
    if (!dragHabilitado) return;
    e.preventDefault();
    const pageId =
      e.dataTransfer.getData('application/x-post-id') ||
      e.dataTransfer.getData('text/plain');
    const diaOrigem = e.dataTransfer.getData('application/x-dia-origem');
    setDiaOver(null);
    setArrastandoId(null);
    if (!pageId) return;
    if (diaOrigem && diaOrigem === diaIso) return; // soltou no mesmo dia
    onMoverPost?.(pageId, diaIso);
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={mesAnterior}
            className="rounded-md border border-bd/50 px-2 py-1 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <h2 className="min-w-[180px] text-center text-base font-medium capitalize">
            {nomeMes(ano, mesNum)}
          </h2>
          <button
            onClick={proxMes}
            className="rounded-md border border-bd/50 px-2 py-1 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
            aria-label="Próximo mês"
          >
            ›
          </button>
          <button
            onClick={hojeMes}
            className="ml-2 rounded-md border border-bd/50 px-2 py-1 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            Hoje
          </button>
        </div>
        <p className="text-xs text-fg-muted">
          {posts.length} post(s) no período visível
          {dragHabilitado && (
            <span className="ml-2 text-fg-muted/60">· arraste pra mover</span>
          )}
        </p>
      </div>

      {/* Legenda dos status (bolinhas). */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-fg-muted">
        <LegendaStatus status="Aguardando" />
        <LegendaStatus status="Aprovado" />
        <LegendaStatus status="Agendado" />
        <LegendaStatus status="Pendente Zernio" />
        <LegendaStatus status="Publicado" />
        <LegendaStatus status="Publicado parcial" />
        <LegendaStatus status="Falhou" />
        <LegendaStatus status="Rejeitado" />
      </div>

      <div className="overflow-hidden rounded-lg border border-bd/30 bg-surface">
        <div className="grid grid-cols-7 border-b border-bd/30 bg-surface-2/40 text-center text-xs uppercase tracking-wide text-fg-muted">
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
            const estaDropTarget = diaOver === iso && Boolean(arrastandoId);
            return (
              <div
                key={iso}
                onDragOver={(e) => handleDragOver(e, iso)}
                onDragLeave={(e) => handleDragLeave(e, iso)}
                onDrop={(e) => handleDrop(e, iso)}
                className={[
                  'min-h-[110px] border-b border-r border-bd/15 p-1.5 transition-colors',
                  noMes ? 'bg-surface/60 text-fg-muted/55' : 'bg-surface',
                  estaDropTarget ? 'bg-primary/15 ring-1 ring-inset ring-primary/40' : '',
                ].join(' ')}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ' +
                      (ehHoje ? 'bg-primary font-medium text-app' : 'text-fg-muted')
                    }
                  >
                    {d.getDate()}
                  </span>
                  {lista.length > 0 && (
                    <span className="text-[10px] text-fg-muted/55">
                      {lista.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {visiveis.map((p) => {
                    const sendoArrastado = arrastandoId === p.pageId;
                    const pendente = pendentes?.has(p.pageId);
                    return (
                      <div
                        key={p.pageId}
                        draggable={dragHabilitado && !pendente}
                        onDragStart={(e) => handleDragStart(e, p.pageId, iso)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onSelecionar(p)}
                        title={`${labelDoStatus(p.status)} · ${horaCurta(p.dataPublicacao ?? p.publicadoEm)} · ${p.nome}${dragHabilitado ? '\n(arraste pra mover de dia)' : ''}`}
                        className={[
                          'flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[10px] leading-tight transition cursor-pointer',
                          'hover:bg-surface-2',
                          sendoArrastado ? 'opacity-40' : '',
                          pendente ? 'opacity-50' : '',
                          dragHabilitado && !pendente ? 'cursor-grab active:cursor-grabbing' : '',
                        ].join(' ')}
                      >
                        <StatusDot status={p.status} />
                        <span className="font-medium text-fg-muted">
                          {horaCurta(p.dataPublicacao ?? p.publicadoEm)}
                        </span>{' '}
                        <span className="truncate text-fg">{p.cliente || p.tipo}</span>
                      </div>
                    );
                  })}
                  {sobra > 0 && (
                    <button
                      onClick={() => setDiaAberto(iso)}
                      className="block w-full rounded px-1.5 py-0.5 text-left text-[10px] text-fg-muted hover:bg-surface-2 hover:text-fg"
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

      {/* placeholder pra popover do dia — segue abaixo */}
      {diaAberto && (
        <div className="fixed inset-0 z-30" onClick={() => setDiaAberto(null)}>
          <div className="absolute inset-0 bg-app/70 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-1/2 top-1/2 max-h-[80vh] w-[min(560px,90vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-bd/30 bg-surface shadow-xl"
          >
            <header className="flex items-center justify-between border-b border-bd/30 px-4 py-3">
              <h3 className="font-medium">
                {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(
                  new Date(`${diaAberto}T00:00:00`),
                )}
              </h3>
              <button
                onClick={() => setDiaAberto(null)}
                className="text-fg-muted hover:text-fg"
              >
                ✕
              </button>
            </header>
            <ul className="max-h-[60vh] divide-y divide-bd/20 overflow-y-auto">
              {postsDoDiaAberto.map((p) => (
                <li key={p.pageId}>
                  <button
                    onClick={() => {
                      onSelecionar(p);
                      setDiaAberto(null);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2"
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
                        <span className="text-xs font-medium text-fg-muted">
                          {horaCurta(p.dataPublicacao ?? p.publicadoEm)}
                        </span>
                        <StatusBadge status={p.status} />
                        {p.redes.map((r) => (
                          <RedeBadge key={r} rede={r} />
                        ))}
                      </div>
                      <p className="mt-1 truncate text-sm">{p.nome}</p>
                      <p className="text-[11px] text-fg-muted">
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

function LegendaStatus({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <StatusDot status={status} />
      {labelDoStatus(status)}
    </span>
  );
}
