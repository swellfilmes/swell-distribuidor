import { NextResponse } from 'next/server';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { consumirConviteOnboarding } from '@/lib-web/convitesOnboarding';

export const dynamic = 'force-dynamic';

interface Body {
  nomeEmpresa?: string;
  slug?: string;
}

const SLUG_REGEX = /^[a-z0-9-]+$/;

/**
 * Rota AUTENTICADA — depois do testador fazer signup, ele submete o nome da
 * empresa dele e este endpoint cria tudo (empresa pendente + membership owner
 * + marca convite consumido). Cliente redireciona pro wizard de onboarding.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'Faça login antes.' }, { status: 401 });
  }
  const { token } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const nomeEmpresa = (body.nomeEmpresa ?? '').trim();
  const slug = (body.slug ?? '').trim().toLowerCase();
  if (!nomeEmpresa) {
    return NextResponse.json({ error: 'Nome da empresa obrigatório.' }, { status: 400 });
  }
  if (!slug || !SLUG_REGEX.test(slug)) {
    return NextResponse.json(
      { error: 'Slug inválido. Use letras minúsculas, números e hífens.' },
      { status: 400 },
    );
  }

  try {
    const r = await consumirConviteOnboarding(token, user.id, nomeEmpresa, slug);
    return NextResponse.json(r);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
