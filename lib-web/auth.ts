import { eq, and, isNull, sql } from 'drizzle-orm';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/src/db/index';
import { users, empresas, empresaUsers, convites } from '@/src/db/schema';

export interface UsuarioApp {
  id: string;
  email: string;
  nome: string | null;
  role: 'admin' | 'member';
}

export interface EmpresaResumo {
  id: number;
  slug: string;
  nome: string;
  role: 'owner' | 'editor';
}

/**
 * Garante que o usuário do Clerk está espelhado no nosso `users`.
 * - Se o email bater com SWELL_ADMIN_EMAIL, vira admin e ganha
 *   membership 'owner' na empresa Swell.
 * - Consome convites pendentes (email match) criando memberships.
 */
export async function syncUsuarioAtual(): Promise<UsuarioApp | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const clerk = await currentUser();
  if (!clerk) return null;

  const email = clerk.primaryEmailAddress?.emailAddress ?? clerk.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error('Usuário Clerk sem email — não consigo sincronizar.');
  }

  const emailLower = email.toLowerCase().trim();
  const nome =
    [clerk.firstName, clerk.lastName].filter(Boolean).join(' ').trim() ||
    clerk.username ||
    null;

  const adminEmail = process.env.SWELL_ADMIN_EMAIL?.toLowerCase().trim();
  const isAdmin = !!adminEmail && emailLower === adminEmail;
  const role: 'admin' | 'member' = isAdmin ? 'admin' : 'member';

  // Upsert do usuário
  await db
    .insert(users)
    .values({ id: userId, email, nome, role })
    .onConflictDoUpdate({
      target: users.id,
      set: { email, nome, role },
    });

  // Admin → garante membership na Swell como 'owner'
  if (isAdmin) {
    const swell = await db
      .select({ id: empresas.id })
      .from(empresas)
      .where(eq(empresas.slug, 'swell'))
      .limit(1);
    if (swell.length > 0) {
      await db
        .insert(empresaUsers)
        .values({ empresaId: swell[0].id, userId, role: 'owner' })
        .onConflictDoNothing();
    }
  }

  // Consome convites pendentes (case-insensitive)
  const pendentes = await db
    .select()
    .from(convites)
    .where(
      and(
        sql`lower(${convites.email}) = ${emailLower}`,
        isNull(convites.consumidoEm),
      ),
    );
  for (const c of pendentes) {
    await db
      .insert(empresaUsers)
      .values({ empresaId: c.empresaId, userId, role: c.role })
      .onConflictDoNothing();
    await db
      .update(convites)
      .set({ consumidoEm: new Date() })
      .where(eq(convites.id, c.id));
  }

  return { id: userId, email, nome, role };
}

/** Lista empresas em que o usuário atual é membro. */
export async function listarEmpresasDoUsuario(): Promise<EmpresaResumo[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const linhas = await db
    .select({
      id: empresas.id,
      slug: empresas.slug,
      nome: empresas.nome,
      role: empresaUsers.role,
    })
    .from(empresaUsers)
    .innerJoin(empresas, eq(empresas.id, empresaUsers.empresaId))
    .where(and(eq(empresaUsers.userId, userId), eq(empresas.ativo, true)));

  return linhas.map((l) => ({
    id: l.id,
    slug: l.slug,
    nome: l.nome,
    role: l.role as 'owner' | 'editor',
  }));
}

/** Valida que o usuário pertence à empresa de `slug` e retorna a empresa. */
export async function exigirAcessoEmpresa(slug: string): Promise<EmpresaResumo> {
  const minhas = await listarEmpresasDoUsuario();
  const e = minhas.find((m) => m.slug === slug);
  if (!e) {
    throw new Error(
      `Você não tem acesso à empresa "${slug}", ou ela não existe.`,
    );
  }
  return e;
}

/** Garante que o usuário logado é admin. Lança 403-like se não for. */
export async function exigirAdmin(): Promise<UsuarioApp> {
  const user = await syncUsuarioAtual();
  if (!user) throw new Error('Não autenticado.');
  if (user.role !== 'admin') throw new Error('Apenas admin pode acessar isso.');
  return user;
}
