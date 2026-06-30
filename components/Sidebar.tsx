'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const itens = [
  { href: '/app', label: 'Visão geral', match: /^\/app$/ },
  { href: '/app/posts', label: 'Tabela', match: /^\/app\/posts/ },
  { href: '/app/upload', label: 'Subir mídia', match: /^\/app\/upload/ },
  { href: '/app/configuracoes', label: 'Configurações', match: /^\/app\/configuracoes/ },
];

interface Props {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: Props) {
  const pathname = usePathname();
  const todosItens = isAdmin
    ? [...itens, { href: '/app/admin', label: 'Admin · Empresas', match: /^\/app\/admin/ }]
    : itens;

  return (
    <aside className="hidden w-56 shrink-0 border-r border-ink/10 bg-cream/50 px-4 py-6 md:block">
      <div className="mb-8 px-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
        Swell
      </div>
      <nav className="space-y-1">
        {todosItens.map((item) => {
          const ativo = item.match.test(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                'block rounded-md px-3 py-2 text-sm transition-colors ' +
                (ativo
                  ? 'bg-ink text-cream'
                  : 'text-ink/80 hover:bg-ink/5')
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
