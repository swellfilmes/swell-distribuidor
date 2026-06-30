import Link from 'next/link';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import { temNotionConectado, temZernioConectado } from '@/src/tenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardHome() {
  const user = await syncUsuarioAtual();
  const empresa = await getEmpresaAtiva();

  // Usa o helper temZernioConectado pra aceitar tanto Swell legacy (apiKey
  // própria + accountId) quanto empresa-testador (profileId + accountId).
  // Sem isso, testador via Profile nunca ficava "pronto" porque o boolean
  // só checava zernioApiKey.
  let notionPronto = false;
  let zernioPronto = false;
  if (empresa) {
    try {
      const tenant = await loadTenantConfig(empresa.slug);
      notionPronto = temNotionConectado(tenant);
      zernioPronto = temZernioConectado(tenant);
    } catch {
      // Sem tenant carregável (empresa pendente) — segue como não-pronto.
    }
  }
  const setupCompleto = notionPronto && zernioPronto;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">
          Olá, {user?.nome ?? user?.email}.
        </h1>
        <p className="text-fg-muted">
          {empresa
            ? `Empresa ativa: ${empresa.nome} (${empresa.slug}).`
            : 'Você ainda não tem empresa vinculada — peça pro admin te adicionar ou use um link de convite.'}
        </p>
      </header>

      {empresa && !setupCompleto && (
        <section className="rounded-xl border border-primary/30 bg-primary/8 p-5">
          <h2 className="text-sm font-medium text-fg">Onboarding incompleto</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Falta conectar {!notionPronto && <b className="text-primary">Notion</b>}
            {!notionPronto && !zernioPronto && ' e '}
            {!zernioPronto && <b className="text-primary">Zernio</b>} pra publicar de verdade.
          </p>
          <Link
            href={`/app/onboarding?empresa=${empresa.id}`}
            className="mt-3 inline-block rounded-lg bg-primary px-3 py-2 text-xs font-medium text-app hover:opacity-90"
          >
            Continuar onboarding →
          </Link>
        </section>
      )}

      {empresa && setupCompleto && (
        <section className="grid gap-3 sm:grid-cols-2">
          <CartaoAcao
            href="/app/upload"
            titulo="Subir mídia"
            descricao="Vídeo, foto ou carrossel. A IA classifica e gera as legendas."
          />
          <CartaoAcao
            href="/app/posts"
            titulo="Tabela de posts"
            descricao="Calendário, aprovação e edição inline dos posts no Notion."
          />
          <CartaoAcao
            href="/app/configuracoes"
            titulo="Configurações"
            descricao="Suas integrações (Notion, Zernio), empresas e perfil."
          />
          {user?.role === 'admin' && (
            <CartaoAcao
              href="/app/admin"
              titulo="Admin · Empresas"
              descricao="Cadastrar novas empresas, convites por link, membros."
            />
          )}
        </section>
      )}
    </div>
  );
}

function CartaoAcao({
  href,
  titulo,
  descricao,
}: {
  href: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-bd/40 bg-surface/40 p-4 transition-colors hover:border-bd/70 hover:bg-surface-2/60"
    >
      <div className="text-[15px] font-medium text-fg">{titulo}</div>
      <div className="mt-1 text-xs text-fg-muted">{descricao}</div>
    </Link>
  );
}
