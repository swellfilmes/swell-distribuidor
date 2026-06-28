import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib-web/auth';
import { cancelarConviteOnboarding } from '@/lib-web/convitesOnboarding';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await exigirAdmin();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;
  const n = parseInt(id, 10);
  if (!Number.isFinite(n)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }
  await cancelarConviteOnboarding(n);
  return NextResponse.json({ ok: true });
}
