import { NextResponse } from 'next/server';
import { z } from 'zod';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { carregarPost, assertPagePertenceAoTenant } from '@/lib-web/notionData';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import { ajustarCopyComFeedback } from '@/src/brain/ajustarCopyComFeedback';
import { notionDo } from '@/src/lib/clients';
import { chunkRichText } from '@/src/lib/notionChunks';
import { lerBody } from '@/lib-web/validators';
import type { PlanoPublicacao } from '@/src/types';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    instrucao: z.string().min(3).max(2000),
  })
  .strict();

/**
 * POST /api/posts/[pageId]/ajustar-copy
 *
 * Reescreve a copy do post seguindo uma INSTRUÇÃO em texto livre passada
 * pelo usuário ("mais direto", "menciona a marca", "menos formal", etc).
 *
 * Só atualiza Copy + PlanoJSON no Notion — não toca status, redes, data,
 * thumbnail.
 *
 * Não requer role especial: qualquer membro da empresa pode ajustar
 * legendas de posts do próprio tenant.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ pageId: string }> },
): Promise<Response> {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const empresa = await getEmpresaAtiva();
  if (!empresa) {
    return NextResponse.json({ error: 'sem empresa ativa' }, { status: 400 });
  }
  const { pageId } = await ctx.params;
  const tenant = await loadTenantConfig(empresa.slug);

  const parsed = await lerBody(req, bodySchema);
  if (!parsed.ok) return parsed.resposta;
  const { instrucao } = parsed.data;

  try {
    await assertPagePertenceAoTenant(tenant, pageId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  const post = await carregarPost(tenant, pageId);
  if (!post) {
    return NextResponse.json({ error: 'post não encontrado' }, { status: 404 });
  }
  if (!post.plano) {
    return NextResponse.json(
      {
        error: 'Esse post não tem plano estruturado ainda — não dá pra ajustar por IA. Rode a reanálise primeiro.',
      },
      { status: 400 },
    );
  }

  try {
    const novoPlano = await ajustarCopyComFeedback(post.plano, instrucao, tenant.tomVoz);

    const copyTextual = novoPlano.copy
      .map((c) => `[${c.rede}] ${c.descricao}`)
      .join('\n\n');
    const planoFinal: PlanoPublicacao = novoPlano;
    const notion = notionDo(tenant);
    await notion.pages.update({
      page_id: pageId,
      properties: {
        Copy: { rich_text: chunkRichText(copyTextual) },
        PlanoJSON: { rich_text: chunkRichText(JSON.stringify(planoFinal)) },
      } as never,
    });

    return NextResponse.json({ ok: true, plano: planoFinal });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
