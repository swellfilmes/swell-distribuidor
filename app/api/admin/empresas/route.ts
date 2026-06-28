import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib-web/auth';
import {
  criarEmpresa,
  listarEmpresasAdmin,
  type CriarEmpresaInput,
} from '@/lib-web/adminEmpresas';

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

export async function GET() {
  const e = await admin();
  if (e) return e;
  const empresas = await listarEmpresasAdmin();
  return NextResponse.json({ empresas });
}

export async function POST(req: Request) {
  const e = await admin();
  if (e) return e;
  const body = (await req.json().catch(() => ({}))) as Partial<CriarEmpresaInput>;
  // A partir de 2.7.A: só nome e slug obrigatórios. Notion/Zernio conectam depois
  // (OAuth Notion via wizard, Zernio via form). Empresa nasce "pendente" se faltar.
  const obrigatorios: (keyof CriarEmpresaInput)[] = ['nome', 'slug'];
  for (const k of obrigatorios) {
    if (!body[k]) {
      return NextResponse.json({ error: `Campo "${k}" obrigatório` }, { status: 400 });
    }
  }
  try {
    const r = await criarEmpresa(body as CriarEmpresaInput);
    return NextResponse.json(r);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
