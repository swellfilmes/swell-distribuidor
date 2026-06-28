import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  empresas,
  empresaUsers,
  tenantSecrets,
  convites,
  users,
} from '@/src/db/schema';
import { cifrar, decifrar } from '@/src/db/encryption';
import { invalidarCache } from '@/src/db/tenantConfig';

export interface EmpresaResumoAdmin {
  id: number;
  slug: string;
  nome: string;
  ativo: boolean;
  criadaEm: Date;
  numMembros: number;
  numConvitesPendentes: number;
}

export interface SegredosForm {
  notionApiKey?: string;
  notionDbId?: string;
  zernioApiKey?: string;
  zernioYoutubeAccountId?: string;
  zernioInstagramAccountId?: string;
  zernioTiktokAccountId?: string;
  zernioLinkedinAccountId?: string;
}

export interface EmpresaDetalhada {
  id: number;
  slug: string;
  nome: string;
  ativo: boolean;
  criadaEm: Date;
  // Segredos descifrados pra exibir (admin only). Strings vazias quando não preenchidos
  // (empresa em onboarding ainda sem conectar Notion/Zernio).
  notionApiKey: string;
  notionDbId: string;
  zernioApiKey: string;
  zernioYoutubeAccountId: string | null;
  zernioInstagramAccountId: string | null;
  zernioTiktokAccountId: string | null;
  zernioLinkedinAccountId: string | null;
  membros: Array<{ userId: string; email: string; nome: string | null; role: string }>;
  convitesPendentes: Array<{ id: number; email: string; role: string; criadoEm: Date }>;
}

export async function listarEmpresasAdmin(): Promise<EmpresaResumoAdmin[]> {
  const linhas = await db
    .select({
      id: empresas.id,
      slug: empresas.slug,
      nome: empresas.nome,
      ativo: empresas.ativo,
      criadaEm: empresas.criadaEm,
      numMembros: sql<number>`(select count(*)::int from ${empresaUsers} where ${empresaUsers.empresaId} = ${empresas.id})`,
      numConvites: sql<number>`(select count(*)::int from ${convites} where ${convites.empresaId} = ${empresas.id} and ${convites.consumidoEm} is null)`,
    })
    .from(empresas)
    .orderBy(empresas.criadaEm);
  return linhas.map((l) => ({
    id: l.id,
    slug: l.slug,
    nome: l.nome,
    ativo: l.ativo,
    criadaEm: l.criadaEm,
    numMembros: l.numMembros,
    numConvitesPendentes: l.numConvites,
  }));
}

export async function carregarEmpresaDetalhada(id: number): Promise<EmpresaDetalhada | null> {
  const linha = await db
    .select()
    .from(empresas)
    .innerJoin(tenantSecrets, eq(empresas.id, tenantSecrets.empresaId))
    .where(eq(empresas.id, id))
    .limit(1);
  if (linha.length === 0) return null;
  const { empresas: e, tenant_secrets: s } = linha[0];

  const membros = await db
    .select({
      userId: empresaUsers.userId,
      role: empresaUsers.role,
      email: users.email,
      nome: users.nome,
    })
    .from(empresaUsers)
    .innerJoin(users, eq(users.id, empresaUsers.userId))
    .where(eq(empresaUsers.empresaId, id));

  const pendentes = await db
    .select({
      id: convites.id,
      email: convites.email,
      role: convites.role,
      criadoEm: convites.criadoEm,
    })
    .from(convites)
    .where(and(eq(convites.empresaId, id), isNull(convites.consumidoEm)));

  return {
    id: e.id,
    slug: e.slug,
    nome: e.nome,
    ativo: e.ativo,
    criadaEm: e.criadaEm,
    notionApiKey: s.notionApiKeyEncrypted ? decifrar(s.notionApiKeyEncrypted) : '',
    notionDbId: s.notionDbId ?? '',
    zernioApiKey: s.zernioApiKeyEncrypted ? decifrar(s.zernioApiKeyEncrypted) : '',
    zernioYoutubeAccountId: s.zernioYoutubeAccountId,
    zernioInstagramAccountId: s.zernioInstagramAccountId,
    zernioTiktokAccountId: s.zernioTiktokAccountId,
    zernioLinkedinAccountId: s.zernioLinkedinAccountId,
    membros,
    convitesPendentes: pendentes,
  };
}

export interface CriarEmpresaInput {
  nome: string;
  slug: string;
  // Todas as integrações opcionais a partir de 2.7.A: empresa em onboarding começa
  // só com nome+slug e conecta Notion/Zernio depois via wizard.
  notionApiKey?: string;
  notionDbId?: string;
  zernioApiKey?: string;
  zernioYoutubeAccountId?: string;
  zernioInstagramAccountId?: string;
  zernioTiktokAccountId?: string;
  zernioLinkedinAccountId?: string;
}

export async function criarEmpresa(input: CriarEmpresaInput): Promise<{ id: number }> {
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    throw new Error('Slug deve ter só letras minúsculas, números e hífens.');
  }
  const r = await db
    .insert(empresas)
    .values({ slug: input.slug, nome: input.nome, ativo: true })
    .returning({ id: empresas.id });
  const empresaId = r[0].id;
  await db.insert(tenantSecrets).values({
    empresaId,
    notionApiKeyEncrypted: input.notionApiKey ? cifrar(input.notionApiKey) : null,
    notionDbId: input.notionDbId ?? null,
    zernioApiKeyEncrypted: input.zernioApiKey ? cifrar(input.zernioApiKey) : null,
    zernioYoutubeAccountId: input.zernioYoutubeAccountId ?? null,
    zernioInstagramAccountId: input.zernioInstagramAccountId ?? null,
    zernioTiktokAccountId: input.zernioTiktokAccountId ?? null,
    zernioLinkedinAccountId: input.zernioLinkedinAccountId ?? null,
  });
  return { id: empresaId };
}

export interface AtualizarEmpresaInput {
  nome?: string;
  ativo?: boolean;
  segredos?: SegredosForm & { notionDbId?: string };
}

export async function atualizarEmpresa(
  id: number,
  input: AtualizarEmpresaInput,
): Promise<void> {
  // Atualiza tabela empresas
  const setEmpresa: Record<string, unknown> = {};
  if (input.nome !== undefined) setEmpresa.nome = input.nome;
  if (input.ativo !== undefined) setEmpresa.ativo = input.ativo;
  if (Object.keys(setEmpresa).length > 0) {
    await db.update(empresas).set(setEmpresa).where(eq(empresas.id, id));
  }

  // Atualiza segredos (somente campos preenchidos)
  if (input.segredos) {
    const set: Record<string, unknown> = { atualizadoEm: new Date() };
    const s = input.segredos;
    if (s.notionApiKey) set.notionApiKeyEncrypted = cifrar(s.notionApiKey);
    if (s.notionDbId !== undefined) set.notionDbId = s.notionDbId;
    if (s.zernioApiKey) set.zernioApiKeyEncrypted = cifrar(s.zernioApiKey);
    if (s.zernioYoutubeAccountId !== undefined)
      set.zernioYoutubeAccountId = s.zernioYoutubeAccountId || null;
    if (s.zernioInstagramAccountId !== undefined)
      set.zernioInstagramAccountId = s.zernioInstagramAccountId || null;
    if (s.zernioTiktokAccountId !== undefined)
      set.zernioTiktokAccountId = s.zernioTiktokAccountId || null;
    if (s.zernioLinkedinAccountId !== undefined)
      set.zernioLinkedinAccountId = s.zernioLinkedinAccountId || null;
    if (Object.keys(set).length > 1) {
      await db.update(tenantSecrets).set(set).where(eq(tenantSecrets.empresaId, id));
    }
  }

  // Invalida cache em memória do tenantConfig
  const slug = (await db.select({ slug: empresas.slug }).from(empresas).where(eq(empresas.id, id)).limit(1))[0]?.slug;
  if (slug) invalidarCache(slug);
}

/**
 * Convida alguém pra uma empresa. Se já existir usuário com esse email no nosso
 * `users`, cria membership direto. Senão, cria convite e o user vira membro
 * quando logar pela primeira vez (consumido em syncUsuarioAtual).
 */
export async function convidarParaEmpresa(
  empresaId: number,
  email: string,
  role: 'owner' | 'editor',
  criadoPor: string,
): Promise<{ status: 'membership-imediato' | 'convite-pendente' }> {
  const emailLower = email.toLowerCase().trim();
  if (!emailLower.includes('@')) throw new Error('Email inválido.');

  // Já existe user com esse email?
  const userExistente = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${emailLower}`)
    .limit(1);

  if (userExistente.length > 0) {
    await db
      .insert(empresaUsers)
      .values({ empresaId, userId: userExistente[0].id, role })
      .onConflictDoNothing();
    return { status: 'membership-imediato' };
  }

  // Senão: cria/atualiza convite pendente
  const existing = await db
    .select({ id: convites.id })
    .from(convites)
    .where(
      and(
        eq(convites.empresaId, empresaId),
        sql`lower(${convites.email}) = ${emailLower}`,
        isNull(convites.consumidoEm),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(convites)
      .set({ role, criadoPor })
      .where(eq(convites.id, existing[0].id));
  } else {
    await db
      .insert(convites)
      .values({ empresaId, email: emailLower, role, criadoPor });
  }
  return { status: 'convite-pendente' };
}

export async function removerMembro(empresaId: number, userId: string): Promise<void> {
  await db
    .delete(empresaUsers)
    .where(and(eq(empresaUsers.empresaId, empresaId), eq(empresaUsers.userId, userId)));
}

export async function cancelarConvite(empresaId: number, conviteId: number): Promise<void> {
  await db
    .delete(convites)
    .where(and(eq(convites.empresaId, empresaId), eq(convites.id, conviteId)));
}
