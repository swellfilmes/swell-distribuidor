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

function ehErroSlugDuplicado(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /duplicate key|unique constraint|empresas_slug/i.test(msg);
}

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
 * e marca o convite como usado.
 *
 * Race-free: o 1º UPDATE reserva o token atomicamente (WHERE consumido_em IS NULL).
 * Se duas requests entram juntas, só uma consegue UPDATE com affectedRows > 0;
 * a outra recebe "já consumido". Se a criação da empresa falhar depois (slug
 * duplicado, etc), reverte o token pro estado anterior pro testador tentar de novo.
 */
export async function consumirConviteOnboarding(
  token: string,
  userId: string,
  nomeEmpresa: string,
  slug: string,
): Promise<{ empresaId: number; slug: string }> {
  // 1. Reserva o token (UPDATE atomic — só 1 request ganha).
  const reservado = await db
    .update(convitesOnboarding)
    .set({ consumidoEm: new Date(), consumidoPor: userId })
    .where(
      and(
        eq(convitesOnboarding.token, token),
        isNull(convitesOnboarding.consumidoEm),
      ),
    )
    .returning({ id: convitesOnboarding.id });
  if (reservado.length === 0) {
    // Pode ser: token não existe OU já foi consumido por outra request paralela.
    const existe = await db
      .select({ id: convitesOnboarding.id })
      .from(convitesOnboarding)
      .where(eq(convitesOnboarding.token, token))
      .limit(1);
    if (existe.length === 0) throw new Error('Convite não encontrado.');
    throw new Error('Esse convite já foi usado por outra pessoa (ou por você num clique anterior).');
  }

  // 2. Garante user no banco (normalmente já existe via syncUsuarioAtual).
  const u = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (u.length === 0) {
    // Rollback: libera o token de novo.
    await db
      .update(convitesOnboarding)
      .set({ consumidoEm: null, consumidoPor: null })
      .where(eq(convitesOnboarding.token, token));
    throw new Error('Usuário não encontrado — faça login antes.');
  }

  // 3. Cria empresa. Se slug duplicado (constraint unique), rollback do token.
  let empresaId: number;
  try {
    const r = await criarEmpresa({ nome: nomeEmpresa, slug });
    empresaId = r.id;
  } catch (err) {
    await db
      .update(convitesOnboarding)
      .set({ consumidoEm: null, consumidoPor: null })
      .where(eq(convitesOnboarding.token, token));
    if (ehErroSlugDuplicado(err)) {
      throw new Error(`Slug "${slug}" já está em uso. Escolha outro.`);
    }
    throw err;
  }

  // 4. Marca empresa criada no convite + cria membership owner.
  await db
    .update(convitesOnboarding)
    .set({ empresaCriadaId: empresaId })
    .where(eq(convitesOnboarding.token, token));
  await db
    .insert(empresaUsers)
    .values({ empresaId, userId, role: 'owner' })
    .onConflictDoNothing();

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
