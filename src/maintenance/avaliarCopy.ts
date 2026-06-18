import { notionDo } from '../lib/clients';
import { avaliarECorrigir } from '../brain/avaliador';
import { chunkRichText } from '../lib/notionChunks';
import type { TenantConfig } from '../config';
import type { PlanoPublicacao } from '../types';

interface LinhaPraAvaliar {
  pageId: string;
  nome: string;
  plano: PlanoPublicacao;
}

function lerRichText(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; rich_text?: Array<{ plain_text?: string }> };
  if (p.type !== 'rich_text' || !p.rich_text) return '';
  return p.rich_text.map((t) => t.plain_text ?? '').join('').trim();
}

function lerTitle(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; title?: Array<{ plain_text?: string }> };
  if (p.type !== 'title' || !p.title) return '';
  return p.title.map((t) => t.plain_text ?? '').join('').trim();
}

async function buscarLinhasAguardando(
  tenant: TenantConfig,
): Promise<LinhaPraAvaliar[]> {
  const notion = notionDo(tenant);
  const linhas: LinhaPraAvaliar[] = [];
  let cursor: string | undefined;

  do {
    const resp = await notion.databases.query({
      database_id: tenant.notionDbId,
      start_cursor: cursor,
      filter: {
        property: 'Status',
        select: { equals: 'Aguardando' },
      },
      page_size: 100,
    });

    for (const page of resp.results) {
      if (!('properties' in page)) continue;
      const props = page.properties;
      const planoStr = lerRichText(props['PlanoJSON']);
      if (!planoStr) continue;
      let plano: PlanoPublicacao;
      try {
        plano = JSON.parse(planoStr) as PlanoPublicacao;
      } catch {
        continue;
      }
      linhas.push({
        pageId: page.id,
        nome: lerTitle(props['Nome']) || '(sem nome)',
        plano,
      });
    }

    cursor = resp.has_more ? resp.next_cursor ?? undefined : undefined;
  } while (cursor);

  return linhas;
}

async function atualizarLinha(
  tenant: TenantConfig,
  pageId: string,
  planoMelhorado: PlanoPublicacao,
): Promise<void> {
  const notion = notionDo(tenant);
  const copyResumo = planoMelhorado.copy
    .map((c) => `[${c.rede}] ${c.descricao}`)
    .join('\n\n');
  const planoJson = JSON.stringify(planoMelhorado);

  await notion.pages.update({
    page_id: pageId,
    properties: {
      Copy: { rich_text: chunkRichText(copyResumo) },
      PlanoJSON: { rich_text: chunkRichText(planoJson) },
    } as never,
  });
}

export async function avaliarCopyTodas(
  tenant: TenantConfig,
  onLog: (msg: string) => void = (m) => console.log(m),
): Promise<void> {
  onLog('Buscando linhas Aguardando no Notion...');
  const linhas = await buscarLinhasAguardando(tenant);
  onLog(`Encontradas ${linhas.length} linha(s).`);
  if (linhas.length === 0) return;

  let ok = 0;
  let falhou = 0;
  let totalNotaAntes = 0;
  let totalNotaDepois = 0;
  let totalAvaliacoes = 0;

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    onLog(`\n[${i + 1}/${linhas.length}] ${l.nome}`);
    try {
      const { planoMelhorado, avaliacoes } = await avaliarECorrigir(l.plano);
      for (const a of avaliacoes) {
        totalAvaliacoes++;
        totalNotaAntes += a.notaAntes;
        totalNotaDepois += a.notaDepois;
        onLog(`  ${a.rede}: ${a.notaAntes} → ${a.notaDepois}  (${a.justificativa})`);
      }
      await atualizarLinha(tenant, l.pageId, planoMelhorado);
      ok++;
      onLog(`  ✅ Notion atualizado.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog(`  ❌ falhou: ${msg}`);
      falhou++;
    }
  }

  const mediaAntes = totalAvaliacoes ? (totalNotaAntes / totalAvaliacoes).toFixed(2) : '-';
  const mediaDepois = totalAvaliacoes ? (totalNotaDepois / totalAvaliacoes).toFixed(2) : '-';

  onLog(`\n═══════════════════════════════════════`);
  onLog(`FIM AVALIAÇÃO. ${ok} ok, ${falhou} falhas, ${linhas.length} total.`);
  onLog(`Média de captions: ${mediaAntes} → ${mediaDepois}`);
  onLog(`═══════════════════════════════════════`);
}
