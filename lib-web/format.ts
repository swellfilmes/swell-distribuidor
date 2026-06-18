const FUSO = 'America/Bahia';

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: FUSO,
});

const fmtData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: FUSO,
});

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return fmtDataHora.format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return fmtData.format(new Date(iso));
  } catch {
    return iso;
  }
}

/** "há 3min", "há 2h", "há 5d" — pra coluna "Atualizado". */
export function tempoRelativo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso ?? '—';
  const segundos = Math.floor((Date.now() - t) / 1000);
  if (segundos < 60) return 'agora';
  if (segundos < 3600) return `${Math.floor(segundos / 60)}min`;
  if (segundos < 86400) return `${Math.floor(segundos / 3600)}h`;
  const dias = Math.floor(segundos / 86400);
  if (dias < 30) return `${dias}d`;
  return formatarData(iso);
}
