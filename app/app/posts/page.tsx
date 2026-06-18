import { redirect } from 'next/navigation';
import { syncUsuarioAtual } from '@/lib-web/auth';
import { getEmpresaAtiva } from '@/lib-web/empresaAtiva';
import { loadTenantConfig } from '@/src/db/tenantConfig';
import {
  listarPostsDoNotion,
  clientesUnicos,
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
      <div className="mx-auto max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
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

  let posts: PostListado[];
  let erro: string | null = null;
  try {
    posts = await listarPostsDoNotion(tenant, { ...filtros, ...ordem });
  } catch (e) {
    posts = [];
    erro = e instanceof Error ? e.message : String(e);
  }

  // Pra montar o filtro de Cliente, busco TODOS os clientes (sem filtro de cliente)
  // se algum filtro de cliente estiver ativo; senão reuso os da lista atual.
  let listaClientes: string[];
  if (filtros.cliente) {
    try {
      const todos = await listarPostsDoNotion(tenant, {
        status: filtros.status,
        mes: filtros.mes,
        tipo: filtros.tipo,
        redes: filtros.redes,
      });
      listaClientes = clientesUnicos(todos);
    } catch {
      listaClientes = clientesUnicos(posts);
    }
  } else {
    listaClientes = clientesUnicos(posts);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tabela de posts</h1>
          <p className="text-sm text-ink/60">
            Empresa: <strong>{empresa.nome}</strong> · {posts.length} post(s)
            mostrado(s)
          </p>
        </div>
      </header>

      {erro && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-900">
          Erro lendo do Notion: {erro}
        </div>
      )}

      <PostsTable
        posts={posts}
        clientes={listaClientes}
        filtros={filtros}
        ordem={ordem}
        geradoEm={new Date().toISOString()}
      />
    </div>
  );
}
