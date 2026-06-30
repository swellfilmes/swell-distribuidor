'use client';

import { useState, useRef, useEffect } from 'react';
import { formatarDataHora } from '@/lib-web/format';

interface Props {
  iso: string | null;
  pendente: boolean;
  onChange: (novoIso: string | null) => void;
}

/**
 * Converte ISO com fuso → "YYYY-MM-DDTHH:mm" pra <input type="datetime-local">.
 * Mantém o horário no fuso America/Bahia (sem mostrar offset no input).
 */
function isoParaInputLocal(iso: string | null): string {
  if (!iso) return '';
  // Tenta extrair direto se já vem como "YYYY-MM-DDTHH:mm:ss±HH:MM"
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

/** Converte "YYYY-MM-DDTHH:mm" → ISO com offset Bahia (-03:00). */
function inputLocalParaIso(local: string): string | null {
  if (!local) return null;
  // Acrescenta segundos e offset Bahia
  return `${local}:00-03:00`;
}

export function InlineDateEdit({ iso, pendente, onChange }: Props) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(isoParaInputLocal(iso));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValor(isoParaInputLocal(iso));
  }, [iso]);

  useEffect(() => {
    if (editando) inputRef.current?.focus();
  }, [editando]);

  function confirmar() {
    setEditando(false);
    const novoIso = inputLocalParaIso(valor);
    if (novoIso !== iso) onChange(novoIso);
  }

  function limpar(e: React.MouseEvent) {
    e.stopPropagation();
    setEditando(false);
    onChange(null);
  }

  if (editando) {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="datetime-local"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmar();
            if (e.key === 'Escape') {
              setEditando(false);
              setValor(isoParaInputLocal(iso));
            }
          }}
          className="rounded border border-bd/20 bg-surface px-1 py-0.5 text-xs"
        />
      </div>
    );
  }

  return (
    <div
      className="group flex items-center gap-1"
      onClick={(e) => {
        e.stopPropagation();
        if (!pendente) setEditando(true);
      }}
    >
      <span
        className={
          'rounded px-1 text-xs ' +
          (pendente
            ? 'opacity-60'
            : 'cursor-pointer hover:bg-primary/5 hover:underline')
        }
      >
        {iso ? formatarDataHora(iso) : <span className="text-fg-muted/40">— definir</span>}
      </span>
      {iso && !pendente && (
        <button
          onClick={limpar}
          className="hidden text-[10px] text-fg-muted/40 hover:text-rose-600 group-hover:inline"
          title="Limpar"
        >
          ✕
        </button>
      )}
      {pendente && <span className="animate-pulse text-[10px] text-fg-muted/40">…</span>}
    </div>
  );
}
