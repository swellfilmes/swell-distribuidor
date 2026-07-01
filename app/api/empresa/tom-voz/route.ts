import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { db } from '@/src/db';
import { empresas, empresaUsers } from '@/src/db/schema';
import { invalidarCache } from '@/src/db/tenantConfig';
import { comRetryDb } from '@/src/db/retry';
import { lerBody } from '@/lib-web/validators';

export const dynamic = 'force-dynamic';

const putBodySchema = z
  .object({
    tomVoz: z.string().max(20_000).nullable().optional(),
  })
  .strict();

/**
 * GET /api/empresa/tom-voz
 * Retorna o tom de voz personalizado da empresa ativa do usuário.
 */
export async function GET(): Promise<Response> {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const empresa = await getEmpresaAtiva();
  if (!empresa) {
    return NextResponse.json({ error: 'sem empresa ativa' }, { status: 400 });
  }

  const linhas = await comRetryDb(() =>
    db
      .select({ tomVoz: empresas.tomVoz })
      .from(empresas)
      .where(eq(empresas.slug, empresa.slug))
      .limit(1),
  );
  const tomVoz = linhas[0]?.tomVoz ?? null;
  return NextResponse.json({ tomVoz });
}

/**
 * PUT /api/empresa/tom-voz
 * Salva o tom de voz personalizado da empresa ativa. Só role='owner'
 * (membership em `empresa_users`) pode alterar. Invalida o cache do
 * TenantConfig depois pra próxima ingestão pegar o novo tom sem restart.
 */
export async function PUT(req: Request): Promise<Response> {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const empresa = await getEmpresaAtiva();
  if (!empresa) {
    return NextResponse.json({ error: 'sem empresa ativa' }, { status: 400 });
  }
  // Só owner pode alterar tom de voz (é decisão de marca, não de operador).
  if (empresa.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Só o owner da empresa pode alterar o tom de voz.' },
      { status: 403 },
    );
  }

  const parsed = await lerBody(req, putBodySchema);
  if (!parsed.ok) return parsed.resposta;
  const { tomVoz } = parsed.data;

  // Confirma que o user é mesmo membro da empresa (defense in depth).
  const membership = await db
    .select({ role: empresaUsers.role })
    .from(empresaUsers)
    .innerJoin(empresas, eq(empresaUsers.empresaId, empresas.id))
    .where(and(eq(empresas.slug, empresa.slug), eq(empresaUsers.userId, user.id)))
    .limit(1);
  if (membership.length === 0 && user.role !== 'admin') {
    return NextResponse.json({ error: 'sem acesso' }, { status: 403 });
  }

  const valorFinal = tomVoz?.trim() ? tomVoz.trim() : null;
  await comRetryDb(() =>
    db
      .update(empresas)
      .set({ tomVoz: valorFinal })
      .where(eq(empresas.slug, empresa.slug)),
  );

  invalidarCache(empresa.slug);

  return NextResponse.json({ ok: true, tomVoz: valorFinal });
}
