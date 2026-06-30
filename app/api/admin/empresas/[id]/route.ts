import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib-web/auth';
import {
  atualizarEmpresa,
  carregarEmpresaDetalhada,
  type AtualizarEmpresaInput,
} from '@/lib-web/adminEmpresas';
import { atualizarEmpresaBodySchema, lerBody } from '@/lib-web/validators';

export const dynamic = 'force-dynamic';

async function admin() {
  try {
    await exigirAdmin();
    return null;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 403 },
    );
  }
}

async function parseId(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = parseInt(id, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const e = await admin();
  if (e) return e;
  const id = await parseId(ctx);
  if (id === null) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  const empresa = await carregarEmpresaDetalhada(id);
  if (!empresa) return NextResponse.json({ error: 'não encontrada' }, { status: 404 });
  return NextResponse.json({ empresa });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const e = await admin();
  if (e) return e;
  const id = await parseId(ctx);
  if (id === null) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  const parsed = await lerBody(req, atualizarEmpresaBodySchema);
  if (!parsed.ok) return parsed.resposta;
  const body: AtualizarEmpresaInput = parsed.data;
  try {
    await atualizarEmpresa(id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
