import { NextResponse } from 'next/server';
import {
  listarEmpresasDoUsuario,
  syncUsuarioAtual,
} from '@/lib-web/auth';

export async function GET() {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const empresas = await listarEmpresasDoUsuario();
  return NextResponse.json({ user, empresas });
}
