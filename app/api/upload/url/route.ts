import { NextResponse } from 'next/server';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import { gerarUrlAssinadaUpload } from '@/src/storage/r2';
import { db } from '@/src/db';
import { jobs } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

interface Body {
  nomeArquivo?: string;
  contentType?: string;
  tamanhoBytes?: number;
  lastModified?: number;
}

const DEDUPE_JANELA_HORAS = 1;

function dedupeKey(nome: string, tamanho?: number, lastModified?: number): string {
  return `${nome}::${tamanho ?? '?'}::${lastModified ?? '?'}`;
}

export async function POST(req: Request) {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const empresa = await getEmpresaAtiva();
  if (!empresa) {
    return NextResponse.json({ error: 'sem empresa ativa' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const nome = body.nomeArquivo?.trim();
  const ct = body.contentType?.trim();
  const tamanho = body.tamanhoBytes;
  if (!nome || !ct) {
    return NextResponse.json(
      { error: 'nomeArquivo e contentType são obrigatórios' },
      { status: 400 },
    );
  }
  if (!ct.startsWith('video/') && !ct.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Só vídeo ou imagem (content-type video/* ou image/*).' },
      { status: 400 },
    );
  }
  if (typeof tamanho !== 'number' || tamanho <= 0) {
    return NextResponse.json(
      { error: 'tamanhoBytes é obrigatório.' },
      { status: 400 },
    );
  }

  const chaveDedupe = dedupeKey(nome, body.tamanhoBytes, body.lastModified);

  // De-dupe: tem job recente da mesma empresa com mesma fingerprint?
  try {
    const corte = new Date(Date.now() - DEDUPE_JANELA_HORAS * 60 * 60 * 1000);
    const existentes = await db
      .select({
        id: jobs.id,
        status: jobs.status,
        result: jobs.result,
        criadoEm: jobs.criadoEm,
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.empresaId, empresa.id),
          eq(jobs.tipo, 'ingest'),
          gt(jobs.criadoEm, corte),
          sql`${jobs.payload}->>'dedupeKey' = ${chaveDedupe}`,
        ),
      )
      .orderBy(desc(jobs.id))
      .limit(1);

    if (existentes.length > 0 && existentes[0].status !== 'failed') {
      const ex = existentes[0];
      return NextResponse.json({
        duplicate: true,
        jobId: ex.id,
        status: ex.status,
        result: ex.result,
        mensagem:
          ex.status === 'done'
            ? 'Esse arquivo já foi processado na última 1h. Reaproveitando.'
            : 'Esse arquivo já está sendo processado (job em andamento). Conectando ao job existente.',
      });
    }
  } catch (err) {
    // De-dupe é otimização — se falhar, segue o fluxo normal
    console.error('[upload/url] dedupe check falhou:', err);
  }

  try {
    const tenant = await loadTenantConfig(empresa.slug);
    const r = await gerarUrlAssinadaUpload(tenant, nome, ct, tamanho);
    return NextResponse.json({ ...r, dedupeKey: chaveDedupe });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
