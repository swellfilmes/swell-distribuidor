import { NextResponse } from 'next/server';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { carregarPost, assertPagePertenceAoTenant } from '@/lib-web/notionData';
import { patchPostNoNotion, type PatchPostInput } from '@/lib-web/notionWrite';
import { lerBody, patchPostInputSchema } from '@/lib-web/validators';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import { excluirPost } from '@/src/maintenance/excluirPost';

export const dynamic = 'force-dynamic';

async function resolverTenant() {
  const user = await syncUsuarioAtual();
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const empresa = await getEmpresaAtiva();
  if (!empresa)
    return { erro: NextResponse.json({ error: 'sem empresa ativa' }, { status: 400 }) };
  const tenant = await loadTenantConfig(empresa.slug);
  return { user, empresa, tenant };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ pageId: string }> },
) {
  const r = await resolverTenant();
  if ('erro' in r) return r.erro;
  const { pageId } = await ctx.params;

  try {
    const post = await carregarPost(r.tenant, pageId);
    if (!post) {
      return NextResponse.json({ error: 'post não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ pageId: string }> },
) {
  const r = await resolverTenant();
  if ('erro' in r) return r.erro;
  const { pageId } = await ctx.params;

  try {
    // Ownership: garante que o pageId pertence ao tenant antes de tocar
    // Zernio/R2/Notion do exclusor.
    await assertPagePertenceAoTenant(r.tenant, pageId);
    const resumo = await excluirPost(r.tenant, pageId);
    return NextResponse.json({ ok: true, resumo });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ pageId: string }> },
) {
  const r = await resolverTenant();
  if ('erro' in r) return r.erro;
  const { pageId } = await ctx.params;

  const parsed = await lerBody(req, patchPostInputSchema);
  if (!parsed.ok) return parsed.resposta;
  const body: PatchPostInput = parsed.data;

  try {
    const resultado = await patchPostNoNotion(r.tenant, pageId, body);
    return NextResponse.json({ ok: true, campos: resultado.campos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
