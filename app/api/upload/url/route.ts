import { NextResponse } from 'next/server';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import { gerarUrlAssinadaUpload } from '@/src/storage/r2';

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
    nomeArquivo?: string;
    contentType?: string;
  };
  const nome = body.nomeArquivo?.trim();
  const ct = body.contentType?.trim();
  if (!nome || !ct) {
    return NextResponse.json(
      { error: 'nomeArquivo e contentType são obrigatórios' },
      { status: 400 },
    );
  }
  if (!ct.startsWith('video/')) {
    return NextResponse.json(
      { error: 'Só vídeos (content-type video/*).' },
      { status: 400 },
    );
  }

  try {
    const tenant = await loadTenantConfig(empresa.slug);
    const r = await gerarUrlAssinadaUpload(tenant, nome, ct);
    return NextResponse.json(r);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
