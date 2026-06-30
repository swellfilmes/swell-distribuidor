import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listarEmpresasDoUsuario, syncUsuarioAtual } from '@/lib-web/auth';
import { EMPRESA_COOKIE } from '@/lib-web/empresaAtiva';
import { lerBody, meEmpresaAtivaBodySchema } from '@/lib-web/validators';

export async function POST(req: Request) {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }

  const parsed = await lerBody(req, meEmpresaAtivaBodySchema);
  if (!parsed.ok) return parsed.resposta;
  const { slug } = parsed.data;

  const minhas = await listarEmpresasDoUsuario();
  const achou = minhas.find((m) => m.slug === slug);
  if (!achou) {
    return NextResponse.json(
      { error: `Você não tem acesso à empresa "${slug}".` },
      { status: 403 },
    );
  }

  const jar = await cookies();
  jar.set(EMPRESA_COOKIE, slug, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 ano
  });

  return NextResponse.json({ ok: true, empresa: achou });
}
