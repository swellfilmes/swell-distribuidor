import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { listarEmpresasDoUsuario, syncUsuarioAtual } from '@/lib-web/auth';
import { db } from '@/src/db';
import { empresas, tenantSecrets } from '@/src/db/schema';
import { invalidarCache, loadTenantConfigById } from '@/src/db/tenantConfig';
import { garantirZernioInicializado, zernioCompartilhado } from '@/src/lib/clients';
import { comRetryDb } from '@/src/db/retry';
import type { Rede } from '@/src/types';

export const dynamic = 'force-dynamic';

const REDES: ReadonlyArray<Rede> = ['instagram', 'youtube', 'tiktok', 'linkedin'];

const REDIRECT_BASE = process.env.ZERNIO_REDIRECT_BASE_URL || 'https://project-42hj6.vercel.app';

function montarRedirect(empresaId: number): string {
  return `${REDIRECT_BASE.replace(/\/$/, '')}/app/onboarding?empresa=${empresaId}&zernio=conectou`;
}

async function exigirMembro(
  ctx: { params: Promise<{ id: string }> },
): Promise<{ empresaId: number } | NextResponse> {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'Faça login antes.' }, { status: 401 });
  }
  const { id: idStr } = await ctx.params;
  const empresaId = parseInt(idStr, 10);
  if (!Number.isFinite(empresaId)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }
  const minhas = await listarEmpresasDoUsuario();
  if (!minhas.some((e) => e.id === empresaId)) {
    return NextResponse.json({ error: 'Você não tem permissão pra essa empresa.' }, { status: 403 });
  }
  return { empresaId };
}

/**
 * POST — cria Profile na conta Zernio da Swell pra essa empresa (se ainda não
 * tem) e devolve as 4 URLs OAuth (instagram, youtube, tiktok, linkedin) pro
 * testador clicar em cada uma e autorizar.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await exigirMembro(ctx);
  if (auth instanceof NextResponse) return auth;
  const { empresaId } = auth;

  try {
    await garantirZernioInicializado();
    const tenant = await loadTenantConfigById(empresaId);
    // SEMPRE usa o cliente compartilhado da Swell — empresa-testador não tem
    // apiKey própria e mesmo a Swell vai criar o Profile na própria conta dela.
    const zernio = zernioCompartilhado();

    let profileId = tenant.zernioProfileId;
    if (!profileId) {
      const resp = await zernio.profiles.createProfile({ body: { name: tenant.nome } });
      const data = (resp as { data?: { profile?: { _id?: string } }; error?: { message?: string } });
      if (data.error) {
        return NextResponse.json(
          { error: `Zernio rejeitou createProfile: ${data.error.message ?? JSON.stringify(data.error)}` },
          { status: 502 },
        );
      }
      const novo = data.data?.profile?._id;
      if (!novo) {
        return NextResponse.json({ error: 'Zernio devolveu createProfile sem profile._id.' }, { status: 502 });
      }
      profileId = novo;
      await comRetryDb(() =>
        db
          .update(tenantSecrets)
          .set({ zernioProfileId: profileId, atualizadoEm: new Date() })
          .where(eq(tenantSecrets.empresaId, empresaId)),
      );
      invalidarCache(tenant.slug);
    }

    const redirectUrl = montarRedirect(empresaId);

    const links: Array<{ rede: Rede; authUrl: string; erro?: string }> = [];
    for (const rede of REDES) {
      try {
        const r = await zernio.connect.getConnectUrl({
          path: { platform: rede },
          query: { profileId, redirect_url: redirectUrl },
        });
        const d = (r as { data?: { authUrl?: string }; error?: { message?: string } });
        if (d.error || !d.data?.authUrl) {
          links.push({ rede, authUrl: '', erro: d.error?.message ?? 'sem authUrl' });
          continue;
        }
        links.push({ rede, authUrl: d.data.authUrl });
      } catch (err) {
        links.push({
          rede,
          authUrl: '',
          erro: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({ profileId, links });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = /Too Many|429|rate/i.test(msg) ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * GET — lê accounts conectadas no Profile via listAccounts(profileId),
 * popula tenant_secrets.zernio*AccountId, e devolve o status por rede.
 * Usado pelo wizard pra polling depois do user clicar nos links.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await exigirMembro(ctx);
  if (auth instanceof NextResponse) return auth;
  const { empresaId } = auth;

  try {
    await garantirZernioInicializado();
    const tenant = await loadTenantConfigById(empresaId);
    if (!tenant.zernioProfileId) {
      return NextResponse.json({
        profileId: null,
        contas: {},
        mensagem: 'Empresa ainda sem Profile no Zernio — chame POST primeiro.',
      });
    }

    // Cliente compartilhado da Swell (não da empresa-testador).
    const zernio = zernioCompartilhado();
    const resp = await zernio.accounts.listAccounts({
      query: { profileId: tenant.zernioProfileId },
    });
    const data = (resp as {
      data?: {
        accounts?: Array<{
          _id?: string;
          platform?: string;
          username?: string;
          displayName?: string;
          isActive?: boolean;
        }>;
      };
      error?: { message?: string };
    });
    if (data.error) {
      return NextResponse.json(
        { error: `Zernio rejeitou listAccounts: ${data.error.message ?? JSON.stringify(data.error)}` },
        { status: 502 },
      );
    }

    const contas: Partial<Record<Rede, { id: string; username?: string; displayName?: string }>> = {};
    for (const a of data.data?.accounts ?? []) {
      const p = a.platform as Rede | undefined;
      if (!p || !REDES.includes(p)) continue;
      if (!a._id) continue;
      if (a.isActive === false) continue;
      contas[p] = {
        id: a._id,
        username: a.username,
        displayName: a.displayName,
      };
    }

    // Popula tenant_secrets com os accountIds descobertos. Importante: só
    // sobrescreve se o Profile retornou ALGUMA conta. Se zero contas no
    // Profile (testador ainda não clicou em link nenhum, ou Swell com Profile
    // recém-criado vazio), mantém os accountIds que já estavam (Swell legacy).
    const algumaContaNoProfile = Object.keys(contas).length > 0;
    if (algumaContaNoProfile) {
      await comRetryDb(() =>
        db
          .update(tenantSecrets)
          .set({
            zernioInstagramAccountId: contas.instagram?.id ?? tenant.zernioInstagramAccountId ?? null,
            zernioYoutubeAccountId: contas.youtube?.id ?? tenant.zernioYoutubeAccountId ?? null,
            zernioTiktokAccountId: contas.tiktok?.id ?? tenant.zernioTiktokAccountId ?? null,
            zernioLinkedinAccountId: contas.linkedin?.id ?? tenant.zernioLinkedinAccountId ?? null,
            atualizadoEm: new Date(),
          })
          .where(eq(tenantSecrets.empresaId, empresaId)),
      );
    }
    const slug = (
      await db.select({ slug: empresas.slug }).from(empresas).where(eq(empresas.id, empresaId)).limit(1)
    )[0]?.slug;
    if (slug) invalidarCache(slug);

    return NextResponse.json({
      profileId: tenant.zernioProfileId,
      contas,
      conectadasCount: Object.keys(contas).length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = /Too Many|429|rate/i.test(msg) ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
