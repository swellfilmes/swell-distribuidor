'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ItemNav {
  href: string;
  label: string;
  match: RegExp;
  icon: string;
}

const itens: ItemNav[] = [
  { href: '/app', label: 'Dashboard', match: /^\/app$/, icon: '◧' },
  { href: '/app/posts', label: 'Posts', match: /^\/app\/posts/, icon: '▤' },
  { href: '/app/upload', label: 'Subir mídia', match: /^\/app\/upload/, icon: '⬆' },
  { href: '/app/configuracoes', label: 'Configurações', match: /^\/app\/configuracoes/, icon: '⚙' },
];

interface Props {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: Props) {
  const pathname = usePathname();
  const todosItens: ItemNav[] = isAdmin
    ? [...itens, { href: '/app/admin', label: 'Admin', match: /^\/app\/admin/, icon: '▦' }]
    : itens;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border-soft/40 bg-surface/40 md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-border-soft/40 px-5">
        <Logo />
        <span className="font-serif text-base leading-none text-text-primary">
          Swell <span className="text-primary">Mermaid</span>
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {todosItens.map((item) => {
          const ativo = item.match.test(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                ativo
                  ? 'bg-surface-2 text-text-primary'
                  : 'text-text-secondary hover:bg-surface-2/60 hover:text-text-primary',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-5 w-5 items-center justify-center text-base',
                  ativo ? 'text-primary' : 'text-text-secondary group-hover:text-text-primary',
                ].join(' ')}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-soft/40 px-5 py-3 text-[11px] text-text-secondary/70">
        <div className="flex items-center justify-between">
          <span>v2.7</span>
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
            ● online
          </span>
        </div>
      </div>
    </aside>
  );
}

function Logo() {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M3 12c3 0 3-4 6-4s3 4 6 4 3-4 6-4" />
        <path d="M3 18c3 0 3-4 6-4s3 4 6 4 3-4 6-4" />
      </svg>
    </span>
  );
}
