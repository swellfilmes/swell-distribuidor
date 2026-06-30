'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ItemNav {
  href: string;
  label: string;
  match: RegExp;
  Icon: (props: { className?: string }) => ReactElement;
}

const itens: ItemNav[] = [
  { href: '/app', label: 'Dashboard', match: /^\/app$/, Icon: IconDashboard },
  { href: '/app/posts', label: 'Posts', match: /^\/app\/posts/, Icon: IconPosts },
  { href: '/app/upload', label: 'Subir mídia', match: /^\/app\/upload/, Icon: IconUpload },
  { href: '/app/configuracoes', label: 'Configurações', match: /^\/app\/configuracoes/, Icon: IconGear },
];

const itemAdmin: ItemNav = {
  href: '/app/admin',
  label: 'Admin',
  match: /^\/app\/admin/,
  Icon: IconAdmin,
};

interface Props {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: Props) {
  const pathname = usePathname();
  const todosItens: ItemNav[] = isAdmin ? [...itens, itemAdmin] : itens;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-bd/40 bg-surface/40 md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-bd/40 px-5">
        <Logo />
        <span className="font-serif text-base leading-none text-fg">
          Swell <span className="text-primary">Mermaid</span>
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {todosItens.map((item) => {
          const ativo = item.match.test(pathname);
          const { Icon } = item;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                ativo
                  ? 'bg-surface-2 text-fg'
                  : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
              ].join(' ')}
            >
              <Icon
                className={[
                  'h-4 w-4 shrink-0',
                  ativo ? 'text-primary' : 'text-fg-muted group-hover:text-fg',
                ].join(' ')}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-bd/40 px-5 py-3 text-[11px] text-fg-muted/70">
        <div className="flex items-center justify-between">
          <span>v2.7</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
            online
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

function svgBase(className?: string) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };
}

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg {...svgBase(className)}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function IconPosts({ className }: { className?: string }) {
  return (
    <svg {...svgBase(className)}>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg {...svgBase(className)}>
      <path d="M12 4v12" />
      <path d="m6 10 6-6 6 6" />
      <path d="M4 20h16" />
    </svg>
  );
}

function IconGear({ className }: { className?: string }) {
  return (
    <svg {...svgBase(className)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconAdmin({ className }: { className?: string }) {
  return (
    <svg {...svgBase(className)}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 9h1" />
      <path d="M9 13h1" />
      <path d="M9 17h1" />
      <path d="M14 9h1" />
      <path d="M14 13h1" />
      <path d="M14 17h1" />
    </svg>
  );
}
