import { NextResponse } from 'next/server';
import { validarConviteOnboarding } from '@/lib-web/convitesOnboarding';

export const dynamic = 'force-dynamic';

/**
 * Rota PÚBLICA — testador acessa antes de logar pra ver se o convite ainda
 * vale e quais campos sugeridos preencher.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const r = await validarConviteOnboarding(token);
  if (!r.ok) {
    const status = r.motivo === 'nao-encontrado' ? 404 : 410;
    return NextResponse.json({ ok: false, motivo: r.motivo }, { status });
  }
  return NextResponse.json(r);
}
