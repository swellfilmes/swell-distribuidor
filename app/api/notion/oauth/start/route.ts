import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { exigirAdmin } from '@/lib-web/auth';

export const dynamic = 'force-dynamic';

const COOKIE_NOME = 'notion_oauth_state';
const COOKIE_MAX_AGE = 60 * 10; // 10 min é mais que suficiente pra um OAuth

export async function GET(req: Request) {
  try {
    await exigirAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  const url = new URL(req.url);
  const empresaIdStr = url.searchParams.get('empresaId');
  const empresaId = empresaIdStr ? parseInt(empresaIdStr, 10) : NaN;
  if (!Number.isFinite(empresaId)) {
    return NextResponse.json({ error: 'empresaId obrigatório (?empresaId=...)' }, { status: 400 });
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
