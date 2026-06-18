import { syncUsuarioAtual, listarEmpresasDoUsuario } from '@/lib-web/auth';

export default async function ConfiguracoesPage() {
  const user = await syncUsuarioAtual();
  const empresas = await listarEmpresasDoUsuario();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-ink/60">
          Admin de empresas e chaves chega na F2.7. Por enquanto, só leitura.
        </p>
      </header>

      <section className="rounded-lg border border-ink/10 bg-white p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-ink/60">
          Seu perfil
        </h2>
        <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-ink/60">Nome</dt>
          <dd>{user?.nome ?? '—'}</dd>
          <dt className="text-ink/60">Email</dt>
          <dd>{user?.email}</dd>
          <dt className="text-ink/60">Role</dt>
          <dd>{user?.role}</dd>
        </dl>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-ink/60">
          Empresas que você acessa
        </h2>
        {empresas.length === 0 ? (
          <p className="mt-2 text-sm text-ink/60">Nenhuma vinculada ainda.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {empresas.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span>{e.nome}</span>
                <span className="text-xs uppercase tracking-wide text-ink/40">
                  {e.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
