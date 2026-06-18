'use client';

import { StatusBadge } from './StatusBadge';
import { STATUS_VALORES } from '@/lib-web/notionData';

interface Props {
  valor: string;
  pendente: boolean;
  onChange: (novo: string) => void;
}

export function InlineStatusEdit({ valor, pendente, onChange }: Props) {
  return (
    <div className="relative inline-block">
      <StatusBadge status={valor} className={pendente ? 'opacity-60' : ''} />
      {pendente && (
        <span className="ml-1 inline-block animate-pulse text-[10px] text-ink/40">
          …
        </span>
      )}
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        disabled={pendente}
        aria-label="Mudar status"
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
      >
        {STATUS_VALORES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
