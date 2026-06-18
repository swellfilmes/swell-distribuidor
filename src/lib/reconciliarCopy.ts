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

async function lerCopyDoNotion(
  tenant: TenantConfig,
  pageId: string,
): Promise<string> {
  const notion = notionDo(tenant);
  const page = await notion.pages.retrieve({ page_id: pageId });
  if (!('properties' in page)) return '';
  const prop = page.properties['Copy'];
  if (!prop || prop.type !== 'rich_text') return '';
  return prop.rich_text.map((t) => ('plain_text' in t ? t.plain_text : '')).join('');
}

export interface ResultadoReconciliacao {
  plano: PlanoPublicacao;
  redesEditadas: Rede[];
}

/**
 * Lê o campo Copy do Notion e, pra cada rede que o usuário editou, sobrescreve
 * a descrição do plano. Limpa hashtags das redes editadas pra não duplicar
 * (o usuário provavelmente colou hashtags inline na descrição).
 */
export async function reconciliarPlanoComNotion(
  tenant: TenantConfig,
  pageId: string,
  plano: PlanoPublicacao,
): Promise<ResultadoReconciliacao> {
  const copyDoNotion = await lerCopyDoNotion(tenant, pageId);
  const edits = parseCopyField(copyDoNotion);

  if (edits.size === 0) {
    return { plano, redesEditadas: [] };
  }

  const redesEditadas: Rede[] = [];
  const novaCopy = plano.copy.map((c) => {
    const editada = edits.get(c.rede);
    if (editada && editada !== c.descricao) {
      redesEditadas.push(c.rede);
      return { ...c, descricao: editada, hashtags: [] };
    }
    return c;
  });

  void REDES;
  return {
    plano: { ...plano, copy: novaCopy },
    redesEditadas,
  };
}
