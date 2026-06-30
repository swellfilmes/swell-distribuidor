import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { syncUsuarioAtual, listarEmpresasDoUsuario } from '@/lib-web/auth';
import { db } from '@/src/db';
import { empresas, tenantSecrets } from '@/src/db/schema';
import { cifrar } from '@/src/db/encryption';
import { invalidarCache } from '@/src/db/tenantConfig';
import { comRetryDb } from '@/src/db/retry';

export const dynamic = 'force-dynamic';

interface Body {
  zernioApiKey?: string;
  zernioYoutubeAccountId?: string;
  zernioInstagramAccountId?: string;
  zernioTiktokAccountId?: string;
  zernioLinkedinAccountId?: string;
}

/**
 * POST /api/empresas/[id]/zernio — owner OU editor da empresa atualiza as
 * credenciais Zernio dela. Não precisa ser admin global. Campos vazios são
 * ignorados (mantém valor atual no banco).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'Faça login antes.' }, { status: 401 });
  }

  const { id: idStr } = await ctx.params;
  const empresaId = parseInt(idStr, 10);
  if (!Number.isFinite(empresaId)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  // Confirma que user é membro dessa empresa.
  const minhasEmpresas = await listarEmpresasDoUsuario();
  if (!minhasEmpresas.some((e) => e.id === empresaId)) {
    return NextResponse.json(
      { error: 'Você não tem permissão pra editar essa empresa.' },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  const set: Record<string, unknown> = { atualizadoEm: new Date() };
  if (body.zernioApiKey) set.zernioApiKeyEncrypted = cifrar(body.zernioApiKey);
  if (body.zernioYoutubeAccountId !== undefined)
    set.zernioYoutubeAccountId = body.zernioYoutubeAccountId || null;
  if (body.zernioInstagramAccountId !== undefined)
    set.zernioInstagramAccountId = body.zernioInstagramAccountId || null;
  if (body.zernioTiktokAccountId !== undefined)
    set.zernioTiktokAccountId = body.zernioTiktokAccountId || null;
  if (body.zernioLinkedinAccountId !== undefined)
    set.zernioLinkedinAccountId = body.zernioLinkedinAccountId || null;

  if (Object.keys(set).length <= 1) {
    return NextResponse.json({ error: 'Nenhum campo pra atualizar.' }, { status: 400 });
  }

  try {
    await comRetryDb(() =>
      db.update(tenantSecrets).set(set).where(eq(tenantSecrets.empresaId, empresaId)),
    );

    // Invalida cache (loadTenantConfig).
    const lookup = await comRetryDb(() =>
      db.select({ slug: empresas.slug }).from(empresas).where(eq(empresas.id, empresaId)).limit(1),
    );
    const slug = lookup[0]?.slug;
    if (slug) invalidarCache(slug);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = /Too Many|429|rate|too many connections/i.test(msg) ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
