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

  // Groq API — transcrição de áudio dos vídeos com Whisper (turbo).
  // OPCIONAL: sem chave, o pipeline continua rodando só com frames — a
  // transcrição vira uma etapa best-effort, nunca bloqueia.
  GROQ_API_KEY: z.string().optional(),
});

const parsed = globalSchema.safeParse(process.env);

if (!parsed.success) {
  const detalhes = parsed.error.issues.map((i) => `  - ${i.message}`).join('\n');
  // Não chamamos process.exit aqui porque esse módulo acaba sendo importado
  // por client components (via lib-web/notionData → src/config) quando Turbopack
  // resolve a árvore de tipos+valores. process.exit no client polyfill é
  // undefined e gera "m.default.exit is not a function" no browser. throw funciona:
  // no server (boot CLI/SSR), o erro propaga e o processo morre igual; no client,
  // só lança se realmente faltar env (que não rola pq client nem lê .env).
  throw new Error(
    `Configuração global inválida no .env:\n${detalhes}\n\n` +
      `Dica: copie o \`.env.example\` para \`.env\` e preencha as chaves.`,
  );
}

export const globalConfig = parsed.data;
export type GlobalConfig = typeof globalConfig;

// TenantConfig + helpers moveram pra ./tenant pra evitar que client components
// puxem `globalConfig` (que lê process.env e quebra no client). Re-exportamos
// aqui pra retrocompat dos imports antigos `from '@/src/config'`.
export {
  type TenantConfig,
  temNotionConectado,
  temZernioConectado,
  integracoesCompletas,
  notionDbIdDo,
} from './tenant';
