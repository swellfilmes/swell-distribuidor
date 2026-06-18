import { notionDo } from '../lib/clients';
import { gerarCronograma, type ItemPraAgendar } from '../brain/agendador';
import type { TenantConfig } from '../config';
import type { PlanoPublicacao, Rede } from '../types';

interface LinhaSemData {
  pageId: string;
  cliente: string;
  tipo: string;
  redes: Rede[];
  resumoCurto: string;
}

function lerRichText(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; rich_text?: Array<{ plain_text?: string }> };
  if (p.type !== 'rich_text' || !p.rich_text) return '';
  return p.rich_text.map((t) => t.plain_text ?? '').join('').trim();
}

async function buscarLinhasSemData(
  tenant: TenantConfig,
): Promise<LinhaSemData[]> {
  const notion = notionDo(tenant);
  const linhas: LinhaSemData[] = [];
  let cursor: string | undefined;

  do {
    const resp = await notion.databases.query({
      database_id: tenant.notionDbId,
      start_cursor: cursor,
      filter: {
        and: [
          { property: 'Status', select: { equals: 'Aguardando' } },
          { property: 'DataPublicacao', date: { is_empty: true } },
        ],
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
        cliente: plano.meta.cliente,
        tipo: plano.meta.tipo,
        redes: plano.redes,
        resumoCurto: plano.resumoInterno,
      });
    }

    cursor = resp.has_more ? resp.next_cursor ?? undefined : undefined;
  } while (cursor);

  return linhas;
}

function paraIsoComBahiaOffset(local: string): string {
  return `${local}-03:00`;
}

export async function agendarTodas(
  tenant: TenantConfig,
  onLog: (msg: string) => void = (m) => console.log(m),
): Promise<void> {
  const notion = notionDo(tenant);
  onLog('Buscando linhas Aguardando sem DataPublicacao...');
  const linhas = await buscarLinhasSemData(tenant);
  onLog(`Encontradas ${linhas.length} linha(s) prontas pra agendar.`);
  if (linhas.length === 0) return;

  const itens: ItemPraAgendar[] = linhas.map((l) => ({
    pageId: l.pageId,
    cliente: l.cliente,
    tipo: l.tipo,
    redes: l.redes,
    resumoCurto: l.resumoCurto,
  }));

  onLog(`\nChamando o agendador (Sonnet 4.6) com as ${itens.length} linhas...`);
  const agenda = await gerarCronograma(itens);
  onLog(`Recebido cronograma com ${agenda.length} entradas.\n`);

  const porPageId = new Map(agenda.map((a) => [a.pageId, a]));

  let aplicadas = 0;
  let semCorrespondencia = 0;
  let falhas = 0;

  for (const l of linhas) {
    const a = porPageId.get(l.pageId);
    if (!a) {
      onLog(`⚠️  pageId ${l.pageId.slice(0, 8)}... (${l.cliente}-${l.tipo}) sem entrada no cronograma; pulando.`);
      semCorrespondencia++;
      continue;
    }
    try {
      const iso = paraIsoComBahiaOffset(a.scheduledFor);
      await notion.pages.update({
        page_id: l.pageId,
        properties: {
          DataPublicacao: { date: { start: iso } },
        } as never,
      });
      onLog(`📅 ${l.cliente} (${l.tipo}) → ${a.scheduledFor}  — ${a.justificativa}`);
      aplicadas++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog(`❌ falhou em ${l.pageId.slice(0, 8)}...: ${msg}`);
      falhas++;
    }
  }

  onLog(`\n═══════════════════════════════════════`);
  onLog(`FIM AGENDAMENTO. ${aplicadas} agendadas, ${semCorrespondencia} sem match, ${falhas} falhas de ${linhas.length}.`);
  onLog(`═══════════════════════════════════════`);
}
