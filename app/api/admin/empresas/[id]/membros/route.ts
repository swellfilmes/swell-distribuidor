import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib-web/auth';
import {
  cancelarConvite,
  convidarParaEmpresa,
  removerMembro,
} from '@/lib-web/adminEmpresas';
import { empresaMembroBodySchema, lerBody } from '@/lib-web/validators';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await exigirAdmin();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const empresaId = parseInt(id, 10);
  if (!Number.isFinite(empresaId))
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  const parsed = await lerBody(req, empresaMembroBodySchema);
  if (!parsed.ok) return parsed.resposta;
  const body = parsed.data;

  try {
    if (body.acao === 'remover-membro' && body.userId) {
      await removerMembro(empresaId, body.userId);
      return NextResponse.json({ ok: true });
    }
    if (body.acao === 'cancelar-convite' && typeof body.conviteId === 'number') {
      await cancelarConvite(empresaId, body.conviteId);
      return NextResponse.json({ ok: true });
    }
    // O schema garante email presente quando não há `acao` definida.
    if (!body.email)
      return NextResponse.json({ error: 'email obrigatório' }, { status: 400 });
    const role: 'owner' | 'editor' = body.role === 'owner' ? 'owner' : 'editor';
    const r = await convidarParaEmpresa(empresaId, body.email, role, admin.id);
    return NextResponse.json(r);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
