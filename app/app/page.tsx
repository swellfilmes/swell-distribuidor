import Link from 'next/link';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { carregarEmpresaDetalhada } from '@/lib-web/adminEmpresas';

export const dynamic = 'force-dynamic';

export default async function DashboardHome() {
  const user = await syncUsuarioAtual();
  const empresa = await getEmpresaAtiva();
  const detalhe = empresa ? await carregarEmpresaDetalhada(empresa.id) : null;
  const notionPronto = Boolean(detalhe?.notionApiKey && detalhe?.notionDbId);
  const zernioPronto = Boolean(detalhe?.zernioApiKey);
  const setupCompleto = notionPronto && zernioPronto;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">
          Olá, {user?.nome ?? user?.email}.
        </h1>
        <p className="text-fg-muted/60">
          {empresa
            ? `Empresa ativa: ${empresa.nome} (${empresa.slug}).`
            : 'Você ainda não tem empresa vinculada — peça pro admin te adicionar ou use um link de convite.'}
        </p>
      </header>

      {empresa && !setupCompleto && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-medium text-amber-900">Onboarding incompleto</h2>
          <p className="mt-1 text-sm text-amber-800/85">
            Falta conectar {!notionPronto && <b>Notion</b>}
            {!notionPronto && !zernioPronto && ' e '}
            {!zernioPronto && <b>Zernio</b>} pra publicar de verdade.
          </p>
          <Link
            href="/app/onboarding"
            className="mt-3 inline-block rounded-md bg-amber-900 px-3 py-2 text-xs font-medium text-amber-50 hover:bg-amber-800"
          >
            Continuar onboarding →
          </Link>
        </section>
      )}

      {empresa && setupCompleto && (
        <section className="grid gap-3 sm:grid-cols-2">
          <CartaoAcao
            href="/app/upload"
            titulo="📤 Subir mídia"
            descricao="Vídeo, foto ou carrossel. A IA classifica e gera as legendas."
          />
          <CartaoAcao
            href="/app/posts"
            titulo="📋 Tabela de posts"
            descricao="Calendário, aprovação e edição inline dos posts no Notion."
          />
          <CartaoAcao
            href="/app/configuracoes"
            titulo="⚙️ Configurações"
            descricao="Suas integrações (Notion, Zernio), empresas e perfil."
          />
          {user?.role === 'admin' && (
            <CartaoAcao
              href="/app/admin"
              titulo="🏢 Admin · Empresas"
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
      className="block rounded-lg border border-bd/10 bg-surface p-4 hover:bg-primary/[0.02]"
    >
      <div className="font-medium">{titulo}</div>
      <div className="mt-1 text-xs text-fg-muted/55">{descricao}</div>
    </Link>
  );
}
