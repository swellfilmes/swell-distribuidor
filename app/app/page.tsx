import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';

export default async function DashboardHome() {
  const user = await syncUsuarioAtual();
  const empresa = await getEmpresaAtiva();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">
          Olá, {user?.nome ?? user?.email}.
        </h1>
        <p className="text-ink/60">
          {empresa
            ? `Empresa ativa: ${empresa.nome} (${empresa.slug}).`
            : 'Você ainda não tem empresa vinculada — peça pro admin te adicionar.'}
        </p>
      </header>

      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium">F2.2 pronta ✅</h2>
        <p className="mt-2 text-sm text-ink/70">
          Login com Clerk funcionando. Seletor de empresa funcionando. Próximas
          fases vão preencher esta tela com:
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-ink/70">
          <li><strong>F2.3</strong> — Tabela do Notion em /app/posts</li>
          <li><strong>F2.4</strong> — Upload de vídeo + cérebro em /app/upload</li>
          <li><strong>F2.5</strong> — Aprovação + edição inline na tabela</li>
          <li><strong>F2.6</strong> — Crons migrados pro Railway</li>
          <li><strong>F2.7</strong> — Admin de empresas em /app/configuracoes</li>
        </ul>
      </section>
    </div>
  );
}
