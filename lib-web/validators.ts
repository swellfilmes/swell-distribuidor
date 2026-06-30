/**
 * Validadores Zod centralizados pras rotas /api/*.
 *
 * Motivação: até 2026-06 todas as rotas faziam `(await req.json()) as Body` —
 * cast cego, zero validação. Resultado: mass-assignment aberto (cliente podia
 * mandar `id`, `criadoEm`, qualquer campo extra e o handler aceitava), tipos
 * mentirosos (TS achava que era `Body`, mas em runtime podia ser `null`, array,
 * string solta), e nada de mensagem de erro útil pro usuário.
 *
 * Aqui ficam:
 *   1. `lerBody` — helper que faz `req.json()` + `schema.safeParse` e devolve
 *      ou os dados validados ou uma `NextResponse` 400 já formatada.
 *   2. Schemas reutilizáveis por recurso (posts, upload, empresas, convites…).
 *
 * Regras explícitas:
 *   - Schemas de update usam `.pick()`/whitelist por campo: NUNCA `.passthrough()`,
 *     NUNCA aceitar `id`/`criadoEm`/etc do client. Mass-assignment é bug.
 *   - `lerBody` SEMPRE retorna 400 em JSON malformado ou inválido. Nunca 500.
 *   - Mensagens em português pro user final (o app é pt-BR).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

/** Resultado discriminado de `lerBody`. */
export type LerBodyResultado<T> =
  | { ok: true; data: T }
  | { ok: false; resposta: NextResponse };

/**
 * Lê o JSON do body, valida contra o schema e devolve:
 *   - {ok:true, data} com os dados já tipados, ou
 *   - {ok:false, resposta} com uma NextResponse 400 pronta pra retornar.
 *
 * Uso típico no handler:
 *   const parsed = await lerBody(req, fooSchema);
 *   if (!parsed.ok) return parsed.resposta;
 *   const body = parsed.data; // tipo inferido
 */
export async function lerBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<LerBodyResultado<T>> {
  let cru: unknown;
  try {
    cru = await req.json();
  } catch {
    return {
      ok: false,
      resposta: NextResponse.json({ error: 'JSON inválido' }, { status: 400 }),
    };
  }

  const result = schema.safeParse(cru);
  if (!result.success) {
    return {
      ok: false,
      resposta: NextResponse.json(
        {
          error: 'Dados inválidos',
          issues: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
            code: i.code,
          })),
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: result.data };
}

// ---------------------------------------------------------------------------
// Schemas primitivos reutilizáveis
// ---------------------------------------------------------------------------

/** Slug de empresa (e qualquer outro slug do app): 2–50 chars, [a-z0-9-]. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{2,50}$/, 'Slug inválido: use 2–50 letras minúsculas, números ou hífens.');

/** UUID padrão (v1–v5). */
export const idSchema = z.string().uuid('UUID inválido.');

/**
 * Page ID do Notion: UUID com OU sem hífens (Notion aceita os dois formatos).
 * 32 hex contínuos, OU 8-4-4-4-12 hex com hífens.
 */
export const pageIdSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'pageId Notion inválido (esperado UUID 32-hex, com ou sem hífens).',
  );

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

/**
 * Espelha `PatchPostInput` em `lib-web/notionWrite.ts:12-22`.
 *
 * Enums (status/tipo/rede) são validados profundamente em `notionWrite.validarEnums`
 * — aqui aceito qualquer string e deixo a função do Notion devolver a mensagem
 * em português listando os válidos. Não duplico o enum aqui pra não desincronizar.
 */
const copyPorRedeSchema = z
  .object({
    descricao: z.string().optional(),
    titulo: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
  })
  .strict();

export const patchPostInputSchema = z
  .object({
    status: z.string().min(1).optional(),
    /** ISO 8601 (com fuso). null/'' limpa. */
    dataPublicacao: z.union([z.string(), z.null()]).optional(),
    cliente: z.string().min(1).optional(),
    tipo: z.string().min(1).optional(),
    redes: z.array(z.string().min(1)).optional(),
    conteudoAI: z.boolean().optional(),
    /** Copy por rede; redes omitidas ficam como estão. */
    copy: z
      .object({
        youtube: copyPorRedeSchema.optional(),
        instagram: copyPorRedeSchema.optional(),
        tiktok: copyPorRedeSchema.optional(),
        linkedin: copyPorRedeSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type PatchPostInputBody = z.infer<typeof patchPostInputSchema>;

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Body do POST /api/upload/url.
 *
 * - nomeArquivo: até 200 chars (R2 / Notion title-line aguentam mais, mas 200
 *   é generoso pra nome de arquivo humano e impede payload abusivo).
 * - contentType: precisa ser video/* OU image/* (regex). A rota fazia checagem
 *   manual com `startsWith` — agora vive aqui.
 * - tamanhoBytes: inteiro positivo, máximo 5 GiB. Acima disso o upload via
 *   R2 presigned PUT começa a falhar e não temos caso de uso.
 * - lastModified: timestamp em ms (epoch). Opcional, usado só na dedupeKey.
 */
export const uploadUrlBodySchema = z
  .object({
    nomeArquivo: z
      .string()
      .trim()
      .min(1, 'nomeArquivo obrigatório')
      .max(200, 'nomeArquivo até 200 caracteres'),
    contentType: z
      .string()
      .trim()
      .regex(
        /^(video|image)\/[A-Za-z0-9.+-]+$/,
        'Só vídeo ou imagem (content-type video/* ou image/*).',
      ),
    tamanhoBytes: z
      .number()
      .int('tamanhoBytes deve ser inteiro')
      .positive('tamanhoBytes deve ser > 0')
      .max(5 * 1024 * 1024 * 1024, 'arquivo acima de 5 GiB não é suportado'),
    lastModified: z.number().int().optional(),
  })
  .strict();

export type UploadUrlBody = z.infer<typeof uploadUrlBodySchema>;

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/**
 * Body do POST /api/jobs.
 *
 * Hoje só `tipo: 'ingest'` é aceito (whitelist na rota). Mantenho a checagem
 * literal aqui pra a rota não precisar fazer if extra — qualquer tipo novo
 * exige adicionar ao schema.
 */
export const criarJobBodySchema = z
  .object({
    tipo: z.literal('ingest'),
    payload: z.record(z.unknown()),
  })
  .strict();

export type CriarJobBody = z.infer<typeof criarJobBodySchema>;

// ---------------------------------------------------------------------------
// Empresas (admin)
// ---------------------------------------------------------------------------

/**
 * Body do POST /api/admin/empresas — criar empresa nova.
 *
 * A partir de 2.7.A só nome+slug são obrigatórios; Notion/Zernio conectam
 * depois via wizard. Aceito os campos legados (notionApiKey, zernioApiKey,
 * accountIds) como opcionais pro caso do admin querer já preencher tudo.
 */
export const criarEmpresaBodySchema = z
  .object({
    nome: z.string().trim().min(1, 'nome obrigatório').max(120),
    slug: slugSchema,
    notionApiKey: z.string().trim().min(1).optional(),
    notionDbId: z.string().trim().min(1).optional(),
    zernioApiKey: z.string().trim().min(1).optional(),
    zernioYoutubeAccountId: z.string().trim().min(1).optional(),
    zernioInstagramAccountId: z.string().trim().min(1).optional(),
    zernioTiktokAccountId: z.string().trim().min(1).optional(),
    zernioLinkedinAccountId: z.string().trim().min(1).optional(),
  })
  .strict();

export type CriarEmpresaBody = z.infer<typeof criarEmpresaBodySchema>;

/**
 * Body do PATCH /api/admin/empresas/[id] — atualizar empresa.
 *
 * Whitelist explícita (NÃO usa `.partial()` cego do schema de criação):
 * o cliente NÃO pode mandar `id`, `slug`, `criadaEm`, `ativo`+`slug` etc
 * que afetem identidade da empresa. Slug imutável, criadaEm gerenciado pelo DB.
 */
const segredosFormSchema = z
  .object({
    notionApiKey: z.string().optional(),
    notionDbId: z.string().optional(),
    zernioApiKey: z.string().optional(),
    zernioYoutubeAccountId: z.string().optional(),
    zernioInstagramAccountId: z.string().optional(),
    zernioTiktokAccountId: z.string().optional(),
    zernioLinkedinAccountId: z.string().optional(),
  })
  .strict();

export const atualizarEmpresaBodySchema = z
  .object({
    nome: z.string().trim().min(1).max(120).optional(),
    ativo: z.boolean().optional(),
    segredos: segredosFormSchema.optional(),
  })
  .strict();

export type AtualizarEmpresaBody = z.infer<typeof atualizarEmpresaBodySchema>;

/**
 * Body do POST /api/admin/empresas/[id]/membros.
 *
 * Três modos discriminados por `acao`:
 *  - undefined (default): convidar — exige email, opcional role
 *  - 'remover-membro': exige userId
 *  - 'cancelar-convite': exige conviteId
 *
 * Modelo refinado: o schema base aceita todos os campos opcionais, e o
 * `.superRefine` valida que a combinação faz sentido. Mantém compat com a
 * rota antiga que fazia if/else.
 */
export const empresaMembroBodySchema = z
  .object({
    email: z.string().email('email inválido').optional(),
    role: z.enum(['owner', 'editor']).optional(),
    acao: z.enum(['remover-membro', 'cancelar-convite']).optional(),
    userId: z.string().min(1).optional(),
    conviteId: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.acao === 'remover-membro' && !v.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'userId obrigatório com acao=remover-membro',
        path: ['userId'],
      });
    }
    if (v.acao === 'cancelar-convite' && v.conviteId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'conviteId obrigatório com acao=cancelar-convite',
        path: ['conviteId'],
      });
    }
    if (v.acao === undefined && !v.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'email obrigatório',
        path: ['email'],
      });
    }
  });

export type EmpresaMembroBody = z.infer<typeof empresaMembroBodySchema>;

// ---------------------------------------------------------------------------
// Empresas (membro): Zernio credentials
// ---------------------------------------------------------------------------

/**
 * Body do POST /api/empresas/[id]/zernio — owner/editor atualiza credenciais
 * Zernio da empresa dele.
 *
 * Todos opcionais — campos vazios ficam como estão no banco. O handler ignora
 * `zernioApiKey === ''`, então aceito string vazia.
 */
export const atualizarZernioBodySchema = z
  .object({
    zernioApiKey: z.string().optional(),
    zernioYoutubeAccountId: z.string().optional(),
    zernioInstagramAccountId: z.string().optional(),
    zernioTiktokAccountId: z.string().optional(),
    zernioLinkedinAccountId: z.string().optional(),
  })
  .strict();

export type AtualizarZernioBody = z.infer<typeof atualizarZernioBodySchema>;

// ---------------------------------------------------------------------------
// Convites onboarding
// ---------------------------------------------------------------------------

/**
 * Body do POST /api/admin/convites-onboarding — admin cria convite.
 * Email opcional, nome empresa sugerido opcional. Tudo opcional pra permitir
 * convite "anônimo" (link compartilhável).
 */
export const convitarOnboardingBodySchema = z
  .object({
    emailSugerido: z.string().email('email inválido').optional(),
    nomeEmpresaSugerido: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type ConvidarOnboardingBody = z.infer<typeof convitarOnboardingBodySchema>;

/**
 * Body do POST /api/convites-onboarding/[token]/consumir.
 * Testador submete nome da empresa que quer criar + slug.
 */
export const consumirConviteBodySchema = z
  .object({
    nomeEmpresa: z.string().trim().min(1, 'Nome da empresa obrigatório.').max(120),
    slug: slugSchema,
  })
  .strict();

export type ConsumirConviteBody = z.infer<typeof consumirConviteBodySchema>;

// ---------------------------------------------------------------------------
// Me / empresa ativa
// ---------------------------------------------------------------------------

/** Body do POST /api/me/empresa-ativa — troca empresa ativa via cookie. */
export const meEmpresaAtivaBodySchema = z
  .object({
    slug: slugSchema,
  })
  .strict();

export type MeEmpresaAtivaBody = z.infer<typeof meEmpresaAtivaBodySchema>;

// ---------------------------------------------------------------------------
// Admin testar credenciais
// ---------------------------------------------------------------------------

/**
 * Body do POST /api/admin/testar — testa credenciais Notion/Zernio sem salvar.
 * Tudo opcional: a rota testa só os pares que foram preenchidos.
 */
export const testarCredenciaisBodySchema = z
  .object({
    notionApiKey: z.string().optional(),
    notionDbId: z.string().optional(),
    zernioApiKey: z.string().optional(),
  })
  .strict();

export type TestarCredenciaisBody = z.infer<typeof testarCredenciaisBodySchema>;
