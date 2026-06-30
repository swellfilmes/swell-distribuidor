import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib-web/auth';
import {
  criarEmpresa,
  listarEmpresasAdmin,
  type CriarEmpresaInput,
} from '@/lib-web/adminEmpresas';
import { criarEmpresaBodySchema, lerBody } from '@/lib-web/validators';

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
  const parsed = await lerBody(req, criarEmpresaBodySchema);
  if (!parsed.ok) return parsed.resposta;
  // A partir de 2.7.A: só nome e slug obrigatórios (schema já garante). Notion/Zernio
  // conectam depois (OAuth Notion via wizard, Zernio via form). Empresa nasce
  // "pendente" se faltar.
  const body: CriarEmpresaInput = parsed.data;
  try {
    const r = await criarEmpresa(body);
    return NextResponse.json(r);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
