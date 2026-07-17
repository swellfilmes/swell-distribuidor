import { NextResponse } from 'next/server';
import { z } from 'zod';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { carregarPost, assertPagePertenceAoTenant } from '@/lib-web/notionData';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import { notionDo } from '@/src/lib/clients';
import { chunkRichText } from '@/src/lib/notionChunks';
import { chaveR2DeUrl } from '@/src/storage/r2';
import { lerBody } from '@/lib-web/validators';
import type { PlanoPublicacao } from '@/src/types';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    ordem: z.array(z.string().url()).min(2).max(20),
  })
  .strict();

/**
 * POST /api/posts/[pageId]/carrossel-ordem
 *
 * Reordena as mídias de um carrossel. `ordem` é a lista completa de URLs
 * (primária + extras) na ordem desejada — ordem[0] vira a capa (Notion.Video),
 * ordem[1..] vira PlanoJSON.mediasExtras.
 *
 * Valida que todas as URLs em `ordem` são exatamente as mesmas que existem
 * hoje no post (não permite adicionar nem remover mídia — só reordenar).
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
  const { ordem } = parsed.data;

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
  if (post.tipo !== 'carrossel') {
    return NextResponse.json(
      { error: 'Só posts do tipo carrossel têm ordem de mídia editável.' },
      { status: 400 },
    );
  }
  if (!post.plano) {
    return NextResponse.json(
      { error: 'Post sem PlanoJSON — não dá pra reordenar.' },
      { status: 400 },
    );
  }
  if (!post.videoUrl) {
    return NextResponse.json(
      { error: 'Post sem mídia principal (Notion.Video vazio).' },
      { status: 400 },
    );
  }

  const extrasAtuais = post.plano.mediasExtras ?? [];
  const urlsAtuais = [post.videoUrl, ...extrasAtuais.map((e) => e.urlPublica)];

  if (ordem.length !== urlsAtuais.length) {
    return NextResponse.json(
      {
        error: `A ordem tem ${ordem.length} itens mas o carrossel tem ${urlsAtuais.length}. Não dá pra adicionar/remover aqui.`,
      },
      { status: 400 },
    );
  }
  const setAtuais = new Set(urlsAtuais);
  for (const u of ordem) {
    if (!setAtuais.has(u)) {
      return NextResponse.json(
        { error: `URL fora da lista original: ${u}` },
        { status: 400 },
      );
    }
  }
  if (new Set(ordem).size !== ordem.length) {
    return NextResponse.json(
      { error: 'A ordem tem URLs duplicadas.' },
      { status: 400 },
    );
  }

  const chavePorUrl = new Map<string, string>();
  for (const extra of extrasAtuais) {
    chavePorUrl.set(extra.urlPublica, extra.chaveR2);
  }
  const chaveDerivada = chaveR2DeUrl(post.videoUrl);
  if (chaveDerivada) chavePorUrl.set(post.videoUrl, chaveDerivada);

  const novaPrimariaUrl = ordem[0];
  const novosExtras = ordem.slice(1).map((url) => ({
    urlPublica: url,
    chaveR2: chavePorUrl.get(url) ?? chaveR2DeUrl(url) ?? '',
  }));

  const planoFinal: PlanoPublicacao = {
    ...post.plano,
    mediasExtras: novosExtras,
  };

  const notion = notionDo(tenant);
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Video: { url: novaPrimariaUrl },
      PlanoJSON: { rich_text: chunkRichText(JSON.stringify(planoFinal)) },
    } as never,
  });

  return NextResponse.json({
    ok: true,
    plano: planoFinal,
    videoUrl: novaPrimariaUrl,
  });
}
