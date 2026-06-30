import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/src/db/index';
import { users } from '@/src/db/schema';
import { comRetryDb } from '@/src/db/retry';

export const dynamic = 'force-dynamic';

/**
 * POST /api/aceitar-termos
 *
 * Marca o usuário logado como tendo aceitado os Termos de Uso + Política de
 * Privacidade (versão v1, 30/06/2026). Grava timestamp UTC em users.termos_aceitos.
 *
 * Idempotente: chamar de novo só atualiza o timestamp.
 *
 * GET /api/aceitar-termos retorna o estado atual ({ aceito: boolean,
 * aceitoEm: ISO|null }) — usado pelo AceiteTermosGate pra decidir se mostra
 * a tela cheia ou libera o app.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }

  const agora = new Date();
  // Não precisamos garantir que a linha existe — o syncUsuarioAtual() do
  // layout cria ANTES de qualquer chamada à UI; mas usamos returning pra
  // detectar a hipótese rara do user nem ter sincronizado ainda.
  const atualizado = await comRetryDb(() =>
    db
      .update(users)
      .set({ termosAceitos: agora })
      .where(eq(users.id, userId))
      .returning({ id: users.id, aceitoEm: users.termosAceitos }),
  );

  if (atualizado.length === 0) {
    return NextResponse.json(
      {
        error:
          'usuário ainda não sincronizado no banco — recarregue a página e tente de novo',
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    aceito: true,
    aceitoEm: atualizado[0].aceitoEm?.toISOString() ?? null,
  });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }

  const linhas = await comRetryDb(() =>
    db
      .select({ aceitoEm: users.termosAceitos })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  );

  // Se a linha ainda não existir (primeira request antes do sync), trata
  // como NÃO aceito — o gate força aceite antes de liberar.
  if (linhas.length === 0) {
    return NextResponse.json({ aceito: false, aceitoEm: null });
  }

  const aceitoEm = linhas[0].aceitoEm;
  return NextResponse.json({
    aceito: Boolean(aceitoEm),
    aceitoEm: aceitoEm ? aceitoEm.toISOString() : null,
  });
}
