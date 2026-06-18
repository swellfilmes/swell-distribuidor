import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { db } from '@/src/db';
import { jobs } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const empresa = await getEmpresaAtiva();
  if (!empresa) {
    return NextResponse.json({ error: 'sem empresa ativa' }, { status: 400 });
  }
  const { id } = await ctx.params;
  const idNum = parseInt(id, 10);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const linhas = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, idNum), eq(jobs.empresaId, empresa.id)))
    .limit(1);

  if (linhas.length === 0) {
    return NextResponse.json({ error: 'job não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ job: linhas[0] });
}
