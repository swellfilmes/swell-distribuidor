import { notionDo } from './clients';
import type { TenantConfig } from '../config';
import type { PlanoPublicacao, Rede } from '../types';

const REDES: readonly Rede[] = ['youtube', 'instagram', 'tiktok', 'linkedin'];

/**
 * Lê o campo Copy do Notion e quebra por rede.
 * Formato esperado: `[youtube] caption do yt...\n\n[linkedin] caption do linkedin...`
 */
export function parseCopyField(texto: string): Map<Rede, string> {
  const mapa = new Map<Rede, string>();
  if (!texto.trim()) return mapa;

  // Quebra o texto em blocos delimitados por "\n\n[" seguindo a rede
  const padraoCabecalho = /\[(youtube|instagram|tiktok|linkedin)\]/gi;
  const matches: Array<{ rede: Rede; inicio: number; conteudoInicio: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = padraoCabecalho.exec(texto)) !== null) {
    matches.push({
      rede: m[1].toLowerCase() as Rede,
      inicio: m.index,
      conteudoInicio: m.index + m[0].length,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const atual = matches[i];
    const fim = i + 1 < matches.length ? matches[i + 1].inicio : texto.length;
    const conteudo = texto.slice(atual.conteudoInicio, fim).trim();
    if (conteudo) mapa.set(atual.rede, conteudo);
  }

  return mapa;
}

interface NotionLeitura {
  copy: string;
  redes: Rede[] | null;
}

async function lerPropriedadesDoNotion(
  tenant: TenantConfig,
  pageId: string,
): Promise<NotionLeitura> {
  const notion = notionDo(tenant);
  const page = await notion.pages.retrieve({ page_id: pageId });
  if (!('properties' in page)) return { copy: '', redes: null };

  // Copy
  let copy = '';
  const propCopy = page.properties['Copy'];
  if (propCopy && propCopy.type === 'rich_text') {
    copy = propCopy.rich_text.map((t) => ('plain_text' in t ? t.plain_text : '')).join('');
  }

  // Redes (multi_select). null = sem propriedade configurada na DB; lista vazia
  // = usuário tirou TODAS as redes (pra não publicar em nenhuma).
  let redes: Rede[] | null = null;
  const propRedes = page.properties['Redes'];
  if (propRedes && propRedes.type === 'multi_select') {
    redes = propRedes.multi_select
      .map((s) => s.name.toLowerCase())
      .filter((s): s is Rede => REDES.includes(s as Rede));
  }

  return { copy, redes };
}

export interface ResultadoReconciliacao {
  plano: PlanoPublicacao;
  redesEditadas: Rede[];
  redesFiltradas: Rede[];
}

/**
 * Sincroniza o plano com o estado ATUAL do Notion antes de publicar. Isso é
 * a fonte de verdade — o usuário pode ter editado depois do ingest:
 *  - `Redes` (multi_select): rede REMOVIDA aqui é tirada do plano. Sem
 *    isso, desmarcar TikTok no Notion não tinha efeito.
 *  - `Copy` (rich_text): texto formatado `[rede] descrição...` por rede.
 *    Quando editado pelo humano, sobrescreve a descrição original.
 */
export async function reconciliarPlanoComNotion(
  tenant: TenantConfig,
  pageId: string,
  plano: PlanoPublicacao,
): Promise<ResultadoReconciliacao> {
  const { copy, redes: redesDoNotion } = await lerPropriedadesDoNotion(tenant, pageId);

  // 1. Filtra redes pelo que o usuário deixou marcado no Notion.
  let novasRedes = plano.redes;
  const redesFiltradas: Rede[] = [];
  if (redesDoNotion !== null) {
    novasRedes = plano.redes.filter((r) => redesDoNotion.includes(r));
    for (const r of plano.redes) {
      if (!redesDoNotion.includes(r)) redesFiltradas.push(r);
    }
  }

  // 2. Atualiza copy pelas edições do humano.
  const edits = parseCopyField(copy);
  const redesEditadas: Rede[] = [];
  const novaCopy = plano.copy
    .filter((c) => novasRedes.includes(c.rede)) // tira copy órfã de rede removida
    .map((c) => {
      const editada = edits.get(c.rede);
      if (editada && editada !== c.descricao) {
        redesEditadas.push(c.rede);
        return { ...c, descricao: editada, hashtags: [] };
      }
      return c;
    });

  return {
    plano: { ...plano, redes: novasRedes, copy: novaCopy },
    redesEditadas,
    redesFiltradas,
  };
}
