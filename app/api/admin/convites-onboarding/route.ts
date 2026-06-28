import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib-web/auth';
import {
  criarConviteOnboarding,
  listarConvitesOnboarding,
  type CriarConviteOnboardingInput,
} from '@/lib-web/convitesOnboarding';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await exigirAdmin();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 403 },
    );
  }
  const convites = await listarConvitesOnboarding();
  return NextResponse.json({ convites });
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await exigirAdmin();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 403 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as Partial<CriarConviteOnboardingInput>;
  try {
    const r = await criarConviteOnboarding(admin.id, {
      emailSugerido: body.emailSugerido,
      nomeEmpresaSugerido: body.nomeEmpresaSugerido,
    });
    return NextResponse.json(r);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
