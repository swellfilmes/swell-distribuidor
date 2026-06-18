import { NextResponse } from 'next/server';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { carregarPost } from '@/lib-web/notionData';
import { patchPostNoNotion, type PatchPostInput } from '@/lib-web/notionWrite';
import { loadTenantConfig } from '@/src/db/tenantConfig';

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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ pageId: string }> },
) {
  const r = await resolverTenant();
  if ('erro' in r) return r.erro;
  const { pageId } = await ctx.params;

  let body: PatchPostInput;
  try {
    body = (await req.json()) as PatchPostInput;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  try {
    const post = await patchPostNoNotion(r.tenant, pageId, body);
    return NextResponse.json({ post });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
