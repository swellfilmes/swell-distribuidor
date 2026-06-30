import { NextResponse } from 'next/server';
import { Client as NotionClient } from '@notionhq/client';
import { Zernio } from '@zernio/node';
import { exigirAdmin } from '@/lib-web/auth';
import { lerBody, testarCredenciaisBodySchema } from '@/lib-web/validators';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await exigirAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  const parsed = await lerBody(req, testarCredenciaisBodySchema);
  if (!parsed.ok) return parsed.resposta;
  const body = parsed.data;

  // --- Notion ---
  let notion:
    | { ok: true; nomeDb: string; numPaginas?: number }
    | { ok: false; erro: string }
    | null = null;
  if (body.notionApiKey && body.notionDbId) {
    try {
      const client = new NotionClient({ auth: body.notionApiKey });
      const db = await client.databases.retrieve({ database_id: body.notionDbId });
      const titulo =
        'title' in db && Array.isArray((db as { title?: Array<{ plain_text?: string }> }).title)
          ? (db as { title: Array<{ plain_text?: string }> }).title
              .map((t) => t.plain_text ?? '')
              .join('')
              .trim()
          : '(sem título)';
      notion = { ok: true, nomeDb: titulo };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notion = { ok: false, erro: msg };
    }
  }

  // --- Zernio ---
  let zernio:
    | { ok: true; contas: Array<{ platform: string; _id: string }> }
    | { ok: false; erro: string }
    | null = null;
  if (body.zernioApiKey) {
    try {
      const client = new Zernio({ apiKey: body.zernioApiKey });
      const resp = await client.accounts.listAccounts({});
      const data = (resp as {
        data?: { accounts?: Array<{ platform: string; _id: string }> };
        error?: { message?: string };
      });
      if (data.error) {
        zernio = { ok: false, erro: data.error.message ?? JSON.stringify(data.error) };
      } else {
        zernio = { ok: true, contas: data.data?.accounts ?? [] };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      zernio = { ok: false, erro: msg };
    }
  }

  return NextResponse.json({ notion, zernio });
}
