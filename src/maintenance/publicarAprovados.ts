import { notionDo } from '../lib/clients';
import { publicarTudo } from '../publish/zernio';
import { resolverAccountIdsDoCliente } from '../clientes/resolverCliente';
import { registrarResultado } from '../log/notion';
import { reconciliarPlanoComNotion } from '../lib/reconciliarCopy';
import { chunkRichText } from '../lib/notionChunks';
import { notionDbIdDo, type TenantConfig } from '../config';
import type {
  MidiaHospedada,
  PlanoPublicacao,
  Rede,
} from '../types';

interface LinhaAprovada {
  pageId: string;
  nome: string;
  plano: PlanoPublicacao;
  videoUrl: string;
  dataPublicacao: string;
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

function lerUrl(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; url?: string | null };
  if (p.type !== 'url' || !p.url) return '';
  return p.url;
}

function lerDateStart(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; date?: { start?: string | null } | null };
  if (p.type !== 'date' || !p.date?.start) return '';
  return p.date.start;
}

async function buscarLinhasAprovadasComData(
  tenant: TenantConfig,
): Promise<LinhaAprovada[]> {
  const notion = notionDo(tenant);
  const linhas: LinhaAprovada[] = [];
  let cursor: string | undefined;

  do {
    // Aprovado sem DataPublicacao = publica AGORA. Aprovado com DataPublicacao
    // futura = agenda no Zernio. Sem essa flexibilidade, testador aprovava e
    // a linha ficava travada porque não preencheu o campo de data.
    const resp = await notion.databases.query({
      database_id: notionDbIdDo(tenant),
      start_cursor: cursor,
      filter: {
        and: [
          { property: 'Status', select: { equals: 'Aprovado' } },
          { property: 'ZernioPostId', rich_text: { is_empty: true } },
        ],
      },
    });

    for (const page of resp.results) {
      if (!('properties' in page)) continue;
      const props = page.properties;

      const planoJsonStr = lerRichText(props['PlanoJSON']);
      if (!planoJsonStr) {
        console.warn(
          `página ${page.id} sem PlanoJSON; pulando (provavelmente é antes do upgrade).`,
        );
        continue;
      }

      let plano: PlanoPublicacao;
      try {
        plano = JSON.parse(planoJsonStr) as PlanoPublicacao;
      } catch {
        console.warn(`página ${page.id} com PlanoJSON inválido; pulando.`);
        continue;
      }

      const videoUrl = lerUrl(props['Video']);
      const dataPublicacao = lerDateStart(props['DataPublicacao']);
      const nome = lerTitle(props['Nome']) || '(sem nome)';

      if (!videoUrl) {
        console.warn(`página ${page.id} sem Video; pulando.`);
        continue;
      }

      // Sem DataPublicacao = string vazia → publicarAprovados detecta como
      // "no passado" e dispara publishNow no Zernio.
      linhas.push({
        pageId: page.id,
        nome,
        plano,
        videoUrl,
        dataPublicacao: dataPublicacao || '',
      });
    }

    cursor = resp.has_more ? resp.next_cursor ?? undefined : undefined;
  } while (cursor);

  return linhas;
}

export async function publicarAprovados(
  tenant: TenantConfig,
  onLog: (msg: string) => void = (m) => console.log(m),
): Promise<void> {
  const notion = notionDo(tenant);
  onLog('Buscando linhas Aprovadas no Notion...');
  const linhas = await buscarLinhasAprovadasComData(tenant);
  onLog(`Encontradas ${linhas.length} linha(s) prontas pra publicar.`);

  if (linhas.length === 0) return;

  for (const linha of linhas) {
    // Sem data preenchida OU com data no passado = publica agora. Só agenda
    // se data for explicitamente futura.
    const semData = !linha.dataPublicacao;
    const noPassado =
      semData || new Date(linha.dataPublicacao).getTime() <= Date.now();
    onLog(
      `\n→ ${linha.nome} (${
        semData
          ? 'sem data definida → publicar agora'
          : noPassado
            ? 'data já passou → publicar agora'
            : `agendar para ${linha.dataPublicacao}`
      })`,
    );
    const midia: MidiaHospedada = {
      urlPublica: linha.videoUrl,
      chaveR2: '(referência via Notion)',
    };

    const { plano: planoFinal, redesEditadas } = await reconciliarPlanoComNotion(
      tenant,
      linha.pageId,
      linha.plano,
    );
    if (redesEditadas.length) {
      onLog(`  ✏️  usando suas edições no Notion: ${redesEditadas.join(', ')}`);
    }

    // Multi-cliente: lookup dinâmico no momento de publicar (não no ingest).
    const accountIdsOverride = await resolverAccountIdsDoCliente(
      tenant,
      planoFinal.meta.cliente,
      (msg) => onLog(`  [cliente] ${msg}`),
    );

    const { resultados, redesIgnoradas, zernioPostId } = await publicarTudo(
      tenant,
      planoFinal,
      midia,
      {
        scheduledFor: noPassado ? undefined : linha.dataPublicacao,
        accountIdsOverride,
        onTick: (msg) => onLog(`  ${msg}`),
      },
    );

    for (const r of resultados) {
      if (r.status === 'agendado') {
        onLog(`  📅 ${r.rede}: agendado`);
      } else if (r.status === 'publicado') {
        onLog(`  ✅ ${r.rede}${r.url ? ` → ${r.url}` : ''}`);
      } else if (r.status === 'pendente') {
        onLog(`  ⏳ ${r.rede}: ${r.erro}`);
      } else {
        onLog(`  ❌ ${r.rede}: ${r.erro}`);
      }
    }
    if (redesIgnoradas.length) {
      for (const rede of redesIgnoradas) {
        onLog(`  ⏭️  ${rede}: ignorada (conta não conectada).`);
      }
    }

    const redes: Rede[] = ['youtube', 'instagram', 'tiktok', 'linkedin'];
    void redes;

    await registrarResultado(tenant, linha.pageId, resultados, redesIgnoradas, zernioPostId);

    // Salva no PlanoJSON a data que mandamos pro Zernio, pro cron de sincronização
    // poder detectar mudanças de data depois.
    if (zernioPostId && !noPassado) {
      const planoComData: PlanoPublicacao = {
        ...planoFinal,
        dataAgendadaEmZernio: linha.dataPublicacao,
      };
      await notion.pages.update({
        page_id: linha.pageId,
        properties: {
          PlanoJSON: { rich_text: chunkRichText(JSON.stringify(planoComData)) },
        } as never,
      });
    }

    onLog(`  ✅ Notion atualizado.`);
  }
}
