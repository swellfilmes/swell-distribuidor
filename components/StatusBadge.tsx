interface Props {
  status: string;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Aguardando: 'bg-primary/12 text-fg ring-amber-200',
  Aprovado: 'bg-blue-100 text-blue-800 ring-blue-200',
  Rejeitado: 'bg-error/15 text-error ring-rose-200',
  Agendado: 'bg-violet-100 text-violet-800 ring-violet-200',
  Publicado: 'bg-success/15 text-success ring-emerald-200',
  'Publicado parcial': 'bg-orange-100 text-orange-800 ring-orange-200',
  'Pendente Zernio': 'bg-slate-100 text-slate-700 ring-slate-200',
  Falhou: 'bg-error/15 text-error ring-red-200',
};

export function StatusBadge({ status, className = '' }: Props) {
  const cls = STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls} ${className}`}
    >
      {status}
    </span>
  );
}

const REDE_LABELS: Record<string, string> = {
  youtube: 'YT',
  instagram: 'IG',
  tiktok: 'TT',
  linkedin: 'LI',
};

const REDE_COLORS: Record<string, string> = {
  youtube: 'bg-error/10 text-error ring-red-100',
  instagram: 'bg-pink-50 text-pink-700 ring-pink-100',
  tiktok: 'bg-slate-100 text-slate-800 ring-slate-200',
  linkedin: 'bg-sky-50 text-sky-700 ring-sky-100',
};

export function RedeBadge({ rede }: { rede: string }) {
  const label = REDE_LABELS[rede] ?? rede.slice(0, 2).toUpperCase();
  const cls = REDE_COLORS[rede] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
  return (
    <span
      title={rede}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}
