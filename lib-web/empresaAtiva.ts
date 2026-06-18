import { cookies } from 'next/headers';
import { listarEmpresasDoUsuario, type EmpresaResumo } from './auth';

const COOKIE = 'empresa_slug';

/**
 * Resolve a empresa ativa do usuário (server-side):
 *  - se ele tem cookie e ainda pertence à empresa → usa
 *  - senão, pega a primeira empresa dele
 *  - se não tem nenhuma → retorna null (UI deve mostrar mensagem)
 */
export async function getEmpresaAtiva(): Promise<EmpresaResumo | null> {
  const minhas = await listarEmpresasDoUsuario();
  if (minhas.length === 0) return null;

  const jar = await cookies();
  const slug = jar.get(COOKIE)?.value;
  if (slug) {
    const achou = minhas.find((m) => m.slug === slug);
    if (achou) return achou;
  }
  return minhas[0];
}

export const EMPRESA_COOKIE = COOKIE;
