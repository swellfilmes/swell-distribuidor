import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { listarEmpresasDoUsuario, syncUsuarioAtual } from '@/lib-web/auth';

export const dynamic = 'force-dynamic';

const COOKIE_NOME = 'notion_oauth_state';
const COOKIE_MAX_AGE = 60 * 10; // 10 min é mais que suficiente pra um OAuth

export async function GET(req: Request) {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'Faça login antes.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const empresaIdStr = url.searchParams.get('empresaId');
  const empresaId = empresaIdStr ? parseInt(empresaIdStr, 10) : NaN;
  if (!Number.isFinite(empresaId)) {
    return NextResponse.json({ error: 'empresaId obrigatório (?empresaId=...)' }, { status: 400 });
  }

  // Aceita qualquer membro da empresa (owner/editor), não só admin global —
  // assim o testador que veio do convite consegue conectar o Notion da empresa
  // dele pelo wizard. Admin segue podendo, claro (admin é membro da Swell).
  const minhas = await listarEmpresasDoUsuario();
  if (!minhas.some((e) => e.id === empresaId)) {
    return NextResponse.json(
      { error: 'Você não tem permissão pra conectar o Notion dessa empresa.' },
      { status: 403 },
    );
  }

  const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
  const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          'OAuth do Notion não configurado. Defina NOTION_OAUTH_CLIENT_ID e NOTION_OAUTH_REDIRECT_URI no .env / Vercel.',
      },
      { status: 500 },
    );
  }

  const nonce = randomBytes(24).toString('hex');
  const payload = Buffer.from(JSON.stringify({ empresaId, nonce })).toString('base64url');

  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NOME,
    value: payload,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  const authorizeUrl = new URL('https://api.notion.com/v1/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('owner', 'user');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', nonce);

  return NextResponse.redirect(authorizeUrl.toString());
}
