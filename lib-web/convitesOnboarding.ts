import { randomBytes } from 'node:crypto';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  convitesOnboarding,
  empresas,
  empresaUsers,
  users,
} from '@/src/db/schema';
import { criarEmpresa } from './adminEmpresas';

export interface ConviteOnboardingResumo {
  id: number;
  token: string;
  emailSugerido: string | null;
  nomeEmpresaSugerido: string | null;
  consumidoEm: Date | null;
  empresaCriadaId: number | null;
  empresaCriadaNome: string | null;
  criadoEm: Date;
}

export interface CriarConviteOnboardingInput {
  emailSugerido?: string;
  nomeEmpresaSugerido?: string;
}

/** Gera token URL-safe de 32 chars (~190 bits de entropia). */
function gerarToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Cria um convite. Admin only. Retorna o token pra montar a URL. */
export async function criarConviteOnboarding(
  criadoPor: string,
  input: CriarConviteOnboardingInput = {},
): Promise<{ id: number; token: string }> {
  const token = gerarToken();
  const r = await db
    .insert(convitesOnboarding)
    .values({
      token,
      criadoPor,
      emailSugerido: input.emailSugerido?.toLowerCase().trim() || null,
      nomeEmpresaSugerido: input.nomeEmpresaSugerido?.trim() || null,
    })
    .returning({ id: convitesOnboarding.id });
  return { id: r[0].id, token };
}

export async function listarConvitesOnboarding(): Promise<ConviteOnboardingResumo[]> {
  const linhas = await db
    .select({
      id: convitesOnboarding.id,
      token: convitesOnboarding.token,
      emailSugerido: convitesOnboarding.emailSugerido,
      nomeEmpresaSugerido: convitesOnboarding.nomeEmpresaSugerido,
      consumidoEm: convitesOnboarding.consumidoEm,
      empresaCriadaId: convitesOnboarding.empresaCriadaId,
      empresaCriadaNome: empresas.nome,
      criadoEm: convitesOnboarding.criadoEm,
    })
    .from(convitesOnboarding)
    .leftJoin(empresas, eq(empresas.id, convitesOnboarding.empresaCriadaId))
    .orderBy(desc(convitesOnboarding.criadoEm));
  return linhas;
}

export async function cancelarConviteOnboarding(id: number): Promise<void> {
  // Só deixa apagar se ainda não foi consumido.
  await db
    .delete(convitesOnboarding)
    .where(and(eq(convitesOnboarding.id, id), isNull(convitesOnboarding.consumidoEm)));
}

export interface ConviteValido {
  ok: true;
  emailSugerido: string | null;
  nomeEmpresaSugerido: string | null;
}
export interface ConviteInvalido {
  ok: false;
  motivo: 'nao-encontrado' | 'ja-consumido';
}

/** Lê o convite e diz se está disponível pra consumo. */
export async function validarConviteOnboarding(
  token: string,
): Promise<ConviteValido | ConviteInvalido> {
  const linha = await db
    .select()
    .from(convitesOnboarding)
    .where(eq(convitesOnboarding.token, token))
    .limit(1);
  if (linha.length === 0) return { ok: false, motivo: 'nao-encontrado' };
  const c = linha[0];
  if (c.consumidoEm) return { ok: false, motivo: 'ja-consumido' };
  return {
    ok: true,
    emailSugerido: c.emailSugerido,
    nomeEmpresaSugerido: c.nomeEmpresaSugerido,
  };
}

/**
 * Consome o convite: cria a empresa solicitada, marca o user como owner dela,
 * e marca o convite como usado. Atômico: se qualquer passo falhar, nada commita.
 */
export async function consumirConviteOnboarding(
  token: string,
  userId: string,
  nomeEmpresa: string,
  slug: string,
): Promise<{ empresaId: number; slug: string }> {
  const valida = await validarConviteOnboarding(token);
  if (!valida.ok) {
    if (valida.motivo === 'nao-encontrado') {
      throw new Error('Convite não encontrado.');
    }
    throw new Error('Esse convite já foi usado por outra pessoa.');
  }

  // Garante que user existe no nosso `users` (o callback do Clerk normalmente
  // já garante via syncUsuarioAtual, mas re-checamos por segurança).
  const u = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (u.length === 0) {
    throw new Error('Usuário não encontrado — faça login antes.');
  }

  // Verifica que slug não colide.
  const colisao = await db
    .select({ id: empresas.id })
    .from(empresas)
    .where(eq(empresas.slug, slug))
    .limit(1);
  if (colisao.length > 0) {
    throw new Error(`Slug "${slug}" já está em uso. Escolha outro.`);
  }

  // Cria empresa (pendente, sem Notion/Zernio ainda).
  const { id: empresaId } = await criarEmpresa({ nome: nomeEmpresa, slug });

  // User vira owner.
  await db
    .insert(empresaUsers)
    .values({ empresaId, userId, role: 'owner' })
    .onConflictDoNothing();

  // Marca convite consumido.
  await db
    .update(convitesOnboarding)
    .set({
      consumidoEm: new Date(),
      consumidoPor: userId,
      empresaCriadaId: empresaId,
    })
    .where(eq(convitesOnboarding.token, token));

  return { empresaId, slug };
}

/** Lista convites pendentes (não consumidos) — usado pra dashboard admin. */
export async function listarConvitesPendentes(): Promise<ConviteOnboardingResumo[]> {
  const linhas = await db
    .select({
      id: convitesOnboarding.id,
      token: convitesOnboarding.token,
      emailSugerido: convitesOnboarding.emailSugerido,
      nomeEmpresaSugerido: convitesOnboarding.nomeEmpresaSugerido,
      consumidoEm: convitesOnboarding.consumidoEm,
      empresaCriadaId: convitesOnboarding.empresaCriadaId,
      empresaCriadaNome: empresas.nome,
      criadoEm: convitesOnboarding.criadoEm,
    })
    .from(convitesOnboarding)
    .leftJoin(empresas, eq(empresas.id, convitesOnboarding.empresaCriadaId))
    .where(isNull(convitesOnboarding.consumidoEm))
    .orderBy(desc(convitesOnboarding.criadoEm));
  return linhas;
}

/** Lista convites consumidos (histórico) — usado pra dashboard admin. */
export async function listarConvitesConsumidos(): Promise<ConviteOnboardingResumo[]> {
  const linhas = await db
    .select({
      id: convitesOnboarding.id,
      token: convitesOnboarding.token,
      emailSugerido: convitesOnboarding.emailSugerido,
      nomeEmpresaSugerido: convitesOnboarding.nomeEmpresaSugerido,
      consumidoEm: convitesOnboarding.consumidoEm,
      empresaCriadaId: convitesOnboarding.empresaCriadaId,
      empresaCriadaNome: empresas.nome,
      criadoEm: convitesOnboarding.criadoEm,
    })
    .from(convitesOnboarding)
    .leftJoin(empresas, eq(empresas.id, convitesOnboarding.empresaCriadaId))
    .where(isNotNull(convitesOnboarding.consumidoEm))
    .orderBy(desc(convitesOnboarding.consumidoEm));
  return linhas;
}
