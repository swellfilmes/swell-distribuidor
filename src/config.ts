import 'dotenv/config';
import { z } from 'zod';

/**
 * Config global do sistema — vars que valem pra TODAS as empresas.
 * Chaves específicas de empresa (Notion, Zernio) ficam no banco em `tenant_secrets`,
 * cifradas, e são carregadas via `loadTenantConfig(slug)` em `src/db/tenantConfig.ts`.
 */
const globalSchema = z.object({
  // Cérebro — Claude API. Swell paga, é uma só pra todas as empresas.
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY ausente no .env'),

  // R2 — bucket único compartilhado. Cada empresa fica em tenants/{empresaId}/...
  R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID ausente no .env'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID ausente no .env'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY ausente no .env'),
  R2_BUCKET: z.string().min(1, 'R2_BUCKET ausente no .env'),
  R2_PUBLIC_BASE_URL: z
    .string()
    .url('R2_PUBLIC_BASE_URL precisa ser uma URL válida'),

  // Banco onde guardamos empresas, usuários, segredos cifrados, fila de jobs.
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL ausente — pegue no console.neon.tech do seu projeto'),

  // Chave mestra usada pra cifrar/decifrar segredos de empresa (AES-256-GCM).
  // Gere com: openssl rand -base64 32
  ENCRYPTION_KEY: z
    .string()
    .min(1, 'ENCRYPTION_KEY ausente — gere com `openssl rand -base64 32`'),
});

const parsed = globalSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Configuração global inválida no .env:\n');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.message}`);
  }
  console.error('\nDica: copie o `.env.example` para `.env` e preencha as chaves.\n');
  process.exit(1);
}

export const globalConfig = parsed.data;
export type GlobalConfig = typeof globalConfig;

/**
 * Config carregado por empresa (descifrado em memória, nunca persistido).
 * Cada chamada que toca Notion ou Zernio recebe um `TenantConfig`.
 */
export interface TenantConfig {
  empresaId: number;
  slug: string;
  nome: string;
  // Opcionais a partir de 2.7.A: empresas em onboarding podem não ter integrações ainda.
  // Quem usa esses campos (notionDo/zernioDo em src/lib/clients) lança erro claro se nulo.
  notionApiKey?: string;
  notionDbId?: string;
  zernioApiKey?: string;
  zernioYoutubeAccountId?: string;
  zernioInstagramAccountId?: string;
  zernioTiktokAccountId?: string;
  zernioLinkedinAccountId?: string;
}

/** Helpers pra checar se uma empresa já tem Notion / Zernio prontos. */
export function temNotionConectado(t: TenantConfig): boolean {
  return Boolean(t.notionApiKey && t.notionDbId);
}
export function temZernioConectado(t: TenantConfig): boolean {
  return Boolean(t.zernioApiKey);
}
export function integracoesCompletas(t: TenantConfig): boolean {
  return temNotionConectado(t) && temZernioConectado(t);
}

/**
 * Retorna o notionDbId da empresa ou lança erro claro se ainda não conectou.
 * Usar em todos os lugares que precisam `database_id` direto.
 */
export function notionDbIdDo(t: TenantConfig): string {
  if (!t.notionDbId) {
    throw new Error(
      `Empresa "${t.slug}" ainda não conectou o Notion (sem database_id). ` +
        `Conecte via wizard de onboarding antes de rodar essa operação.`,
    );
  }
  return t.notionDbId;
}
