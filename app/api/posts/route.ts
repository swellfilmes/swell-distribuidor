import { NextResponse } from 'next/server';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { listarPostsDoNotion } from '@/lib-web/notionData';
import { loadTenantConfig } from '@/src/db/tenantConfig';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const empresa = await getEmpresaAtiva();
  if (!empresa) {
    return NextResponse.json({ error: 'sem empresa ativa' }, { status: 400 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const cliente = url.searchParams.get('cliente') ?? undefined;
  const mes = url.searchParams.get('mes') ?? undefined;

  try {
    const tenant = await loadTenantConfig(empresa.slug);
    const posts = await listarPostsDoNotion(tenant, { status, cliente, mes });
    return NextResponse.json({ empresa, posts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
