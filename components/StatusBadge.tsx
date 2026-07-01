import { labelDoStatus } from '@/lib-web/notionData';

interface Props {
  status: string;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Aguardando: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  Aprovado: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  Rejeitado: 'bg-error/15 text-error ring-error/30',
  Agendado: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
  Publicado: 'bg-success/15 text-success ring-success/30',
  'Publicado parcial': 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  'Pendente Zernio': 'bg-fg-muted/15 text-fg-muted ring-fg-muted/25',
  Falhou: 'bg-error/15 text-error ring-error/30',
};

/**
 * Cor pura em hex (sem alpha ring) — usado pela bolinha de status no
 * calendário. Casa com a mesma paleta do badge acima.
 */
export const STATUS_DOT_COLORS: Record<string, string> = {
  Aguardando: '#F59E0B',
  Aprovado: '#38BDF8',
  Rejeitado: '#EF4444',
  Agendado: '#A78BFA',
  Publicado: '#22C55E',
  'Publicado parcial': '#FB923C',
  'Pendente Zernio': '#94A3B8',
  Falhou: '#EF4444',
};

export function StatusBadge({ status, className = '' }: Props) {
  const cls = STATUS_COLORS[status] ?? 'bg-fg-muted/15 text-fg-muted ring-fg-muted/25';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls} ${className}`}
    >
      {labelDoStatus(status)}
    </span>
  );
}

export function StatusDot({ status, className = '' }: Props) {
  const cor = STATUS_DOT_COLORS[status] ?? '#94A3B8';
  return (
    <span
      title={labelDoStatus(status)}
      style={{ backgroundColor: cor }}
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${className}`}
    />
  );
}

const REDE_LABELS: Record<string, string> = {
  youtube: 'YT',
  instagram: 'IG',
  tiktok: 'TT',
  linkedin: 'LI',
};

const REDE_COLORS: Record<string, string> = {
  youtube: 'bg-red-500/15 text-red-300 ring-red-500/25',
  instagram: 'bg-pink-500/15 text-pink-300 ring-pink-500/25',
  tiktok: 'bg-fg-muted/15 text-fg ring-fg-muted/25',
  linkedin: 'bg-sky-500/15 text-sky-300 ring-sky-500/25',
};

export function RedeBadge({ rede }: { rede: string }) {
  const label = REDE_LABELS[rede] ?? rede.slice(0, 2).toUpperCase();
  const cls = REDE_COLORS[rede] ?? 'bg-fg-muted/15 text-fg-muted ring-fg-muted/25';
  return (
    <span
      title={rede}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}
