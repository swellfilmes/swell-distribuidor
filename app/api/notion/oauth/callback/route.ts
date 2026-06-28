import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { listarEmpresasDoUsuario, syncUsuarioAtual } from '@/lib-web/auth';
import { db } from '@/src/db';
import { empresas, tenantSecrets } from '@/src/db/schema';
import { cifrar } from '@/src/db/encryption';
import { invalidarCache } from '@/src/db/tenantConfig';
import { criarDistribuicaoDb } from '@/src/lib/notion/criarDb';

export const dynamic = 'force-dynamic';

const COOKIE_NOME = 'notion_oauth_state';

interface NotionTokenResponse {
  access_token?: string;
  token_type?: string;
  bot_id?: string;
  workspace_name?: string;
  workspace_id?: string;
  workspace_icon?: string;
  owner?: unknown;
  duplicated_template_id?: string;
}

function htmlErro(titulo: string, detalhe: string): NextResponse {
  const safe = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c),
    );
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${safe(titulo)}</title></head>
<body style="font-family:system-ui;padding:32px;max-width:560px;margin:auto">
<h1 style="color:#b00020">${safe(titulo)}</h1>
<p>${safe(detalhe)}</p>
<p><a href="/app/admin">← Voltar pro admin</a></p>
</body></html>`;
  return new NextResponse(html, { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function GET(req: Request) {
  const user = await syncUsuarioAtual();
  if (!user) {
    return htmlErro('Sem permissão', 'Faça login antes de concluir o OAuth.');
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateRecebido = url.searchParams.get('state');
  const erroOauth = url.searchParams.get('error');

  if (erroOauth) {
    return htmlErro('Notion recusou', `erro retornado: ${erroOauth}`);
  }
  if (!code || !stateRecebido) {
    return htmlErro('Parâmetros faltando', 'O Notion não devolveu code/state. Tente conectar de novo.');
  }

  // Recupera + valida cookie state
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(COOKIE_NOME)?.value;
  if (!cookieVal) {
    return htmlErro('State expirado', 'O cookie de OAuth não foi encontrado (expirou ou o navegador bloqueou). Tente conectar de novo.');
  }
  cookieStore.delete(COOKIE_NOME);

  let payload: { empresaId: number; nonce: string };
  try {
    payload = JSON.parse(Buffer.from(cookieVal, 'base64url').toString('utf-8'));
  } catch {
    return htmlErro('State inválido', 'Cookie corrompido.');
  }
  if (payload.nonce !== stateRecebido) {
    return htmlErro('State mismatch', 'Suspeita de CSRF — o state do cookie não bate com o devolvido pelo Notion.');
  }

  const empresaId = payload.empresaId;

  // Reverifica que o user logado AGORA é membro da empresa que iniciou o OAuth.
  // Protege contra alguém roubar um cookie state e completar OAuth pra empresa
  // alheia.
  const minhas = await listarEmpresasDoUsuario();
  if (!minhas.some((e) => e.id === empresaId)) {
    return htmlErro(
      'Empresa não é sua',
      'Esse OAuth foi iniciado pra uma empresa que você não é membro. Inicie o fluxo de novo a partir do wizard.',
    );
  }

  const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
  const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return htmlErro('Config faltando', 'NOTION_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI não estão definidos no servidor.');
  }

  // Troca code → access_token
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  let tokenJson: NotionTokenResponse;
  try {
    const resp = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    tokenJson = (await resp.json()) as NotionTokenResponse;
    if (!resp.ok || !tokenJson.access_token) {
      return htmlErro(
        'Notion rejeitou a troca de code',
        `status=${resp.status}, resposta: ${JSON.stringify(tokenJson).slice(0, 400)}`,
      );
    }
  } catch (err) {
    return htmlErro('Erro de rede na troca de token', err instanceof Error ? err.message : String(err));
  }

  // Carrega nome da empresa pra titular a DB de forma reconhecível
  const linha = await db
    .select({ id: empresas.id, nome: empresas.nome, slug: empresas.slug })
    .from(empresas)
    .where(eq(empresas.id, empresaId))
    .limit(1);
  if (linha.length === 0) {
    return htmlErro('Empresa não encontrada', `id=${empresaId}`);
  }
  const empresa = linha[0];

  // Cria a database na workspace do usuário
  let resultadoDb: { databaseId: string; parentPageId: string; databaseUrl: string };
  try {
    resultadoDb = await criarDistribuicaoDb(tokenJson.access_token!, empresa.nome);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return htmlErro('Não consegui criar a database no Notion', msg);
  }

  // Atualiza tenant_secrets: troca notionApiKey por access_token OAuth + grava novo databaseId
  await db
    .update(tenantSecrets)
    .set({
      notionApiKeyEncrypted: cifrar(tokenJson.access_token!),
      notionDbId: resultadoDb.databaseId,
      atualizadoEm: new Date(),
    })
    .where(eq(tenantSecrets.empresaId, empresaId));

  invalidarCache(empresa.slug);

  // Sucesso — redirect pro admin com flag
  const destino = new URL('/app/admin/empresas/' + empresaId, url.origin);
  destino.searchParams.set('notion', 'conectado');
  destino.searchParams.set('workspace', tokenJson.workspace_name ?? '');
  return NextResponse.redirect(destino.toString());
}
