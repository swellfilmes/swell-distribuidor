import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Empresas (tenants). Cada empresa publica nas redes dela com chaves próprias.
 * A primeira linha (slug='swell') é o tenant zero — migrado do .env atual.
 */
export const empresas = pgTable('empresas', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nome: text('nome').notNull(),
  ativo: boolean('ativo').notNull().default(true),
  criadaEm: timestamp('criada_em', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Espelho dos usuários do Clerk. Guardamos só o suficiente pra fazer FK
 * e mostrar nome/email sem refetch a cada request.
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  nome: text('nome'),
  role: text('role').notNull().default('member'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Membership de um user em uma empresa.
 * role aqui é dentro da empresa ('owner' = pode editar chaves, 'editor' = só usa).
 */
export const empresaUsers = pgTable(
  'empresa_users',
  {
    empresaId: integer('empresa_id')
      .notNull()
      .references(() => empresas.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('editor'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.empresaId, t.userId] }),
  }),
);

/**
 * Chaves de API por empresa. As _encrypted são AES-256-GCM cifradas com
 * ENCRYPTION_KEY (env). IDs de conta Zernio + Notion DB ID ficam em claro
 * porque não são secretos.
 */
export const tenantSecrets = pgTable('tenant_secrets', {
  empresaId: integer('empresa_id')
    .primaryKey()
    .references(() => empresas.id, { onDelete: 'cascade' }),

  // Nullable a partir de 2.7.A: empresas novas começam sem Notion/Zernio
  // e conectam via onboarding wizard (OAuth Notion / form Zernio).
  notionApiKeyEncrypted: text('notion_api_key_encrypted'),
  notionDbId: text('notion_db_id'),
  // Banco separado no Notion onde cada cliente desse tenant tem 1 linha
  // (Profile Zernio + accountIds por rede). Nullable: tenant só precisa
  // disso quando vai operar com multi-cliente (Fase de Profiles).
  notionClientsDbId: text('notion_clients_db_id'),

  zernioApiKeyEncrypted: text('zernio_api_key_encrypted'),
  zernioYoutubeAccountId: text('zernio_youtube_account_id'),
  zernioInstagramAccountId: text('zernio_instagram_account_id'),
  zernioTiktokAccountId: text('zernio_tiktok_account_id'),
  zernioLinkedinAccountId: text('zernio_linkedin_account_id'),
  // Empresa-testador (criada via convite onboarding) NÃO tem zernioApiKey
  // própria — herda a da Swell (tenant id=1) via fallback no zernioDo(). Tem
  // 1 Profile dentro da conta Zernio Swell, identificado por esse profileId.
  // accountIds acima são populados via listAccounts(profileId) após o testador
  // conectar cada rede pelos links OAuth.
  zernioProfileId: text('zernio_profile_id'),

  atualizadoEm: timestamp('atualizado_em', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Fila de jobs pro worker do Railway. F2.4 vai consumir.
 * Mantemos aqui já no schema pra evitar migrações encadeadas depois.
 */
export const jobs = pgTable(
  'jobs',
  {
    id: serial('id').primaryKey(),
    empresaId: integer('empresa_id')
      .notNull()
      .references(() => empresas.id, { onDelete: 'cascade' }),
    tipo: text('tipo').notNull(),
    status: text('status').notNull().default('pending'),
    payload: jsonb('payload').notNull(),
    result: jsonb('result'),
    erro: text('erro'),
    tentativas: integer('tentativas').notNull().default(0),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
    iniciadoEm: timestamp('iniciado_em', { withTimezone: true }),
    finalizadoEm: timestamp('finalizado_em', { withTimezone: true }),
  },
  (t) => ({
    statusCriadoIdx: index('jobs_status_criado_idx').on(t.status, t.criadoEm),
    empresaIdx: index('jobs_empresa_idx').on(t.empresaId),
  }),
);

/**
 * Convites pendentes: admin convida email X pra empresa Y. Quando X cria conta
 * Clerk e loga pela primeira vez, a sync busca convites por email e cria a
 * membership automaticamente.
 */
export const convites = pgTable(
  'convites',
  {
    id: serial('id').primaryKey(),
    empresaId: integer('empresa_id')
      .notNull()
      .references(() => empresas.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('editor'),
    criadoPor: text('criado_por')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    consumidoEm: timestamp('consumido_em', { withTimezone: true }),
  },
  (t) => ({
    emailIdx: index('convites_email_idx').on(t.email),
  }),
);

/**
 * Convites de onboarding: admin gera um link único (token), manda pra alguém
 * fora do sistema. Quando essa pessoa abre o link, faz signup no Clerk e cria
 * a empresa dela (vira owner automaticamente). Diferente de `convites` (que
 * adiciona alguém a uma empresa existente), aqui o convite CRIA a empresa.
 */
export const convitesOnboarding = pgTable(
  'convites_onboarding',
  {
    id: serial('id').primaryKey(),
    token: text('token').notNull().unique(),
    criadoPor: text('criado_por')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    // Dicas pré-preenchidas no wizard quando o testador abrir o link. Opcionais.
    emailSugerido: text('email_sugerido'),
    nomeEmpresaSugerido: text('nome_empresa_sugerido'),
    // Quando o testador conclui o passo "criar empresa". Token vira de uso único.
    consumidoEm: timestamp('consumido_em', { withTimezone: true }),
    consumidoPor: text('consumido_por').references(() => users.id, {
      onDelete: 'set null',
    }),
    empresaCriadaId: integer('empresa_criada_id').references(() => empresas.id, {
      onDelete: 'set null',
    }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: index('convites_onboarding_token_idx').on(t.token),
  }),
);

export type Empresa = typeof empresas.$inferSelect;
export type TenantSecretsRow = typeof tenantSecrets.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NovoJob = typeof jobs.$inferInsert;
export type Convite = typeof convites.$inferSelect;
export type NovoConvite = typeof convites.$inferInsert;
export type ConviteOnboarding = typeof convitesOnboarding.$inferSelect;
export type NovoConviteOnboarding = typeof convitesOnboarding.$inferInsert;
