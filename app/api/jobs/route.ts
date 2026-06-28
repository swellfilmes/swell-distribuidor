import { NextResponse } from 'next/server';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { db } from '@/src/db';
import { jobs } from '@/src/db/schema';
import { comRetryDb } from '@/src/db/retry';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const empresa = await getEmpresaAtiva();
  if (!empresa) {
    return NextResponse.json({ error: 'sem empresa ativa' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    tipo?: string;
    payload?: Record<string, unknown>;
  };
  const tipo = body.tipo?.trim();
  const payload = body.payload;
  if (!tipo || !payload) {
    return NextResponse.json(
      { error: 'tipo e payload são obrigatórios' },
      { status: 400 },
    );
  }
  // Whitelist: por enquanto só aceito tipo "ingest"
  if (tipo !== 'ingest') {
    return NextResponse.json(
      { error: `tipo "${tipo}" não suportado` },
      { status: 400 },
    );
  }

  try {
    const inserido = await comRetryDb(() =>
      db
        .insert(jobs)
        .values({
          empresaId: empresa.id,
          tipo,
          status: 'pending',
          payload,
        })
        .returning({ id: jobs.id, criadoEm: jobs.criadoEm }),
    );

    return NextResponse.json({ id: inserido[0].id, criadoEm: inserido[0].criadoEm });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Se o Neon devolveu rate-limit mesmo depois dos retries, é 503 (tente
    // de novo) e não 500 (erro permanente) — o client pode mostrar mensagem
    // mais útil ("muito tráfego, tenta de novo").
    const status = /Too Many|429|rate|too many connections/i.test(msg) ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
