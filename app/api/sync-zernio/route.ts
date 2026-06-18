import { NextResponse } from 'next/server';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import { atualizarPendentes } from '@/src/maintenance/atualizarPendentes';

export const dynamic = 'force-dynamic';
// Sync pode demorar (vai bater no Zernio + Notion N vezes). Dá uns 60s.
export const maxDuration = 60;

export async function POST() {
  const user = await syncUsuarioAtual();
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const empresa = await getEmpresaAtiva();
  if (!empresa) {
    return NextResponse.json({ error: 'sem empresa ativa' }, { status: 400 });
  }

  try {
    const tenant = await loadTenantConfig(empresa.slug);
    const logs: string[] = [];
    const onLog = (m: string) => logs.push(m);
    const inicio = Date.now();
    await atualizarPendentes(tenant, onLog);
    const duracaoMs = Date.now() - inicio;
    return NextResponse.json({
      ok: true,
      empresa: empresa.slug,
      duracaoMs,
      logs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
