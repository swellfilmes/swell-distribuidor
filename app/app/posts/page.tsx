import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import { temNotionConectado } from '@/src/config';
import {
  listarPostsDoNotion,
  clientesDaEmpresa,
  type PostListado,
  type CampoSort,
  type DirecaoSort,
} from '@/lib-web/notionData';
import { PostsTable } from '@/components/PostsTable';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    status?: string;
    cliente?: string;
    mes?: string;
    tipo?: string;
    redes?: string;
    sort?: string;
    dir?: string;
  }>;
}

const CAMPOS_SORT_VALIDOS: CampoSort[] = [
  'dataPublicacao',
  'criado',
  'atualizado',
  'status',
  'cliente',
  'tipo',
];

function validarSort(s: string | undefined): CampoSort {
  return CAMPOS_SORT_VALIDOS.includes(s as CampoSort)
    ? (s as CampoSort)
    : 'dataPublicacao';
}

function validarDir(d: string | undefined): DirecaoSort {
  return d === 'asc' ? 'asc' : 'desc';
}

export default async function PostsPage({ searchParams }: Props) {
  const user = await syncUsuarioAtual();
  if (!user) redirect('/sign-in');

  const empresa = await getEmpresaAtiva();
  if (!empresa) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-primary/30 bg-primary/8 p-6 text-sm text-fg">
        Você ainda não tem nenhuma empresa vinculada. Peça pro admin te
        adicionar.
      </div>
    );
  }

  const sp = await searchParams;
  const redes = sp.redes
    ? sp.redes.split(',').map((r) => r.trim()).filter(Boolean)
    : undefined;

  const filtros = {
    status: sp.status || undefined,
    cliente: sp.cliente || undefined,
    mes: sp.mes || undefined,
    tipo: sp.tipo || undefined,
    redes,
  };
  const ordem = {
    sort: validarSort(sp.sort),
    dir: validarDir(sp.dir),
  };

  const tenant = await loadTenantConfig(empresa.slug);

  // Empresa em onboarding (sem Notion) — não tenta query Notion, mostra CTA.
  if (!temNotionConectado(tenant)) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-primary/30 bg-primary/8 p-6">
        <div className="mb-2 text-sm font-medium text-fg">Notion ainda não conectado</div>
        <p className="mb-4 text-sm text-fg-muted">
          A empresa <b className="text-fg">{empresa.nome}</b> ainda não tem a database do Notion
          conectada. Termine o onboarding antes de ver os posts.
        </p>
        <a
          href="/app/onboarding"
          className="inline-block rounded-lg bg-primary px-3 py-2 text-xs font-medium text-app hover:opacity-90"
        >
          Ir pro wizard de onboarding →
        </a>
      </div>
    );
  }

  // Paraleliza as duas queries — antes eram seriais (~2x mais devagar).
  // clientesDaEmpresa é cacheada (TTL 10min) então normalmente é instantânea.
  let posts: PostListado[];
  let listaClientes: string[];
  let erro: string | null = null;
  try {
    const [postsRes, clientesRes] = await Promise.all([
      listarPostsDoNotion(tenant, { ...filtros, ...ordem }).catch((e) => {
        erro = e instanceof Error ? e.message : String(e);
        return [] as PostListado[];
      }),
      clientesDaEmpresa(tenant).catch(() => [] as string[]),
    ]);
    posts = postsRes;
    listaClientes = clientesRes;
  } catch (e) {
    posts = [];
    listaClientes = [];
    erro = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl text-fg">Posts</h1>
          <p className="mt-1 text-sm text-fg-muted">
            <span className="text-fg">{empresa.nome}</span> · {posts.length} post(s)
            mostrado(s)
          </p>
        </div>
      </header>

      {erro && (
        <div className="mb-4 rounded-md border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
          Erro lendo do Notion: {erro}
        </div>
      )}

      <Suspense fallback={<div className="text-sm text-fg-muted/50">Carregando tabela...</div>}>
        <PostsTable
          posts={posts}
          clientes={listaClientes}
          filtros={filtros}
          ordem={ordem}
          geradoEm={new Date().toISOString()}
        />
      </Suspense>
    </div>
  );
}
