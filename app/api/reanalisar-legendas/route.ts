import { NextResponse } from 'next/server';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import { db } from '@/src/db';
import { jobs } from '@/src/db/schema';
import { notionDo } from '@/src/lib/clients';
import { notionDbIdDo } from '@/src/tenant';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reanalisar-legendas
 *
 * Enfileira 1 job de reanálise (tipo='reanalisar') pra cada post com
 * status='Aguardando' da empresa ativa. O worker Railway processa os
 * jobs 1 a 1 (frames por cena + transcrição Groq + tom de voz).
 *
 * Só reescreve Copy + PlanoJSON. Não toca em thumbnail, redes, status
 * ou data de agendamento.
 *
 * Requer role owner ou admin — decisão de conteúdo em massa não é dos
 * membros comuns.
 */
export async function POST(): Promise<Response> {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const empresa = await getEmpresaAtiva();
  if (!empresa) {
    return NextResponse.json({ error: 'sem empresa ativa' }, { status: 400 });
  }
  if (empresa.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Só o owner da empresa (ou admin global) pode disparar reanálise em massa.' },
      { status: 403 },
    );
  }

  const tenant = await loadTenantConfig(empresa.slug);
  const notion = notionDo(tenant);

  const pageIds: string[] = [];
  let cursor: string | undefined;
  try {
    do {
      const resp = await notion.databases.query({
        database_id: notionDbIdDo(tenant),
        start_cursor: cursor,
        filter: { property: 'Status', select: { equals: 'Aguardando' } },
        page_size: 100,
      });
      for (const p of resp.results) {
        pageIds.push(p.id);
      }
      cursor = resp.has_more ? resp.next_cursor ?? undefined : undefined;
    } while (cursor);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Falha lendo posts do Notion: ${msg}` },
      { status: 502 },
    );
  }

  if (pageIds.length === 0) {
    return NextResponse.json({ ok: true, enfileirados: 0, mensagem: 'Nenhum post Aguardando pra reanalisar.' });
  }

  // Enfileira jobs em lote — dedupe defensiva contra o mesmo pageId já ter
  // um job pending/in_progress em aberto (evita 2ª reanálise concorrente).
  const criados: number[] = [];
  for (const pageId of pageIds) {
    try {
      const inserido = await db
        .insert(jobs)
        .values({
          empresaId: tenant.empresaId,
          tipo: 'reanalisar',
          status: 'pending',
          payload: { pageId } as never,
        })
        .returning({ id: jobs.id });
      if (inserido[0]) criados.push(inserido[0].id);
    } catch (err) {
      console.error(`[reanalisar-legendas] falha enfileirando pageId=${pageId}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    enfileirados: criados.length,
    total: pageIds.length,
    mensagem:
      criados.length === pageIds.length
        ? `${criados.length} post(s) na fila. O worker processa cada um em ~1-2min.`
        : `${criados.length}/${pageIds.length} enfileirados. Alguns falharam — cheque os logs.`,
  });
}
