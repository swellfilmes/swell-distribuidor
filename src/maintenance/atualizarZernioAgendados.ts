import { contaConfiguradaPara, notionDo, zernioDo } from '../lib/clients';
import { reconciliarPlanoComNotion } from '../lib/reconciliarCopy';
import { chunkRichText } from '../lib/notionChunks';
import { notionDbIdDo, type TenantConfig } from '../config';
import {
  categoriaDoTipo,
  type CopyPorRede,
  type PlanoPublicacao,
} from '../types';

function mesmaData(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return a === b;
  const tA = Date.parse(a);
  const tB = Date.parse(b);
  if (!Number.isFinite(tA) || !Number.isFinite(tB)) return a === b;
  return tA === tB;
}

function montarConteudo(copy: CopyPorRede): string {
  const tags = copy.hashtags.length ? `\n\n${copy.hashtags.join(' ')}` : '';
  return `${copy.descricao}${tags}`.trim();
}

function dadosEspecificosYoutube(copy: CopyPorRede, plano: PlanoPublicacao): Record<string, unknown> {
  return {
    title: (copy.titulo ?? `${plano.meta.cliente} — ${plano.meta.tipo}`).slice(0, 100),
    visibility: 'public',
    ...(plano.conteudoAI ? { containsSyntheticMedia: true } : {}),
  };
}

interface LinhaAgendada {
  pageId: string;
  nome: string;
  zernioPostId: string;
  plano: PlanoPublicacao;
  dataPublicacao: string;
  videoUrl: string;
}

function lerUrl(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; url?: string | null };
  if (p.type !== 'url' || !p.url) return '';
  return p.url;
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

function lerDateStart(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; date?: { start?: string | null } | null };
  if (p.type !== 'date' || !p.date?.start) return '';
  return p.date.start;
}

async function buscarLinhasAteData(
  tenant: TenantConfig,
  ateInclusive?: string,
): Promise<LinhaAgendada[]> {
  const notion = notionDo(tenant);
  const linhas: LinhaAgendada[] = [];
  let cursor: string | undefined;

  const baseFiltros = [
    { property: 'Status', select: { equals: 'Agendado' } },
    { property: 'ZernioPostId', rich_text: { is_not_empty: true } },
  ];
  const filtroFinal = ateInclusive
    ? {
        and: [
          ...baseFiltros,
          { property: 'DataPublicacao', date: { on_or_before: ateInclusive } },
        ],
      }
    : { and: baseFiltros };

  do {
    const resp = await notion.databases.query({
      database_id: notionDbIdDo(tenant),
      start_cursor: cursor,
      filter: filtroFinal as never,
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
      const zernioPostId = lerRichText(props['ZernioPostId']);
      const dataPublicacao = lerDateStart(props['DataPublicacao']);
      const videoUrl = lerUrl(props['Video']);
      if (!zernioPostId || !dataPublicacao || !videoUrl) continue;
      linhas.push({
        pageId: page.id,
        nome: lerTitle(props['Nome']) || '(sem nome)',
        zernioPostId,
        plano,
        dataPublicacao,
        videoUrl,
      });
    }

    cursor = resp.has_more ? resp.next_cursor ?? undefined : undefined;
  } while (cursor);

  return linhas;
}

export async function atualizarZernioAgendadosAte(
  tenant: TenantConfig,
  ateInclusive: string | undefined,
  onLog: (msg: string) => void = (m) => console.log(m),
): Promise<void> {
  const notion = notionDo(tenant);
  const zernio = zernioDo(tenant);
  if (ateInclusive) {
    onLog(`Buscando linhas Agendadas com DataPublicacao até ${ateInclusive}...`);
  } else {
    onLog(`Buscando TODAS as linhas Agendadas...`);
  }
  const linhas = await buscarLinhasAteData(tenant, ateInclusive);
  onLog(`Encontradas ${linhas.length} linha(s) agendadas.`);
  if (linhas.length === 0) return;

  let atualizados = 0;
  let semEdicao = 0;
  let falhas = 0;

  for (const linha of linhas) {
    onLog(`\n→ ${linha.nome}  (Zernio postId=${linha.zernioPostId})`);

    const { plano: planoFinal, redesEditadas } = await reconciliarPlanoComNotion(
      tenant,
      linha.pageId,
      linha.plano,
    );

    const dataAntes = linha.plano.dataAgendadaEmZernio;
    const dataAgora = linha.dataPublicacao;
    // dataMudou só é "true mudança" se já havia uma data anterior conhecida.
    const dataMudou = dataAntes !== undefined && !mesmaData(dataAntes, dataAgora);
    const precisaBackfill = dataAntes === undefined;

    if (redesEditadas.length === 0 && !dataMudou) {
      if (precisaBackfill) {
        const planoBackfill: PlanoPublicacao = { ...planoFinal, dataAgendadaEmZernio: dataAgora };
        try {
          await notion.pages.update({
            page_id: linha.pageId,
            properties: {
              PlanoJSON: { rich_text: chunkRichText(JSON.stringify(planoBackfill)) },
            } as never,
          });
          onLog(`  ⏭️  sem edições; backfill dataAgendadaEmZernio=${dataAgora}.`);
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          onLog(`  ⏭️  sem edições; backfill falhou: ${m}`);
        }
      } else {
        onLog(`  ⏭️  sem edições detectadas, pulando.`);
      }
      semEdicao++;
      continue;
    }

    const mudancas: string[] = [];
    if (redesEditadas.length) mudancas.push(`copy em ${redesEditadas.join(', ')}`);
    if (dataMudou) mudancas.push(`data (${dataAntes ?? '?'} → ${dataAgora})`);
    onLog(`  ✏️  mudanças detectadas: ${mudancas.join('; ')}`);

    const platformsPayload: Array<{
      platform: string;
      accountId: string;
      customContent?: string;
      platformSpecificData?: Record<string, unknown>;
    }> = [];

    for (const rede of planoFinal.redes) {
      const accountId = contaConfiguradaPara(tenant, rede);
      if (!accountId) continue;
      const copy = planoFinal.copy.find((c) => c.rede === rede);
      if (!copy) continue;
      const platItem: typeof platformsPayload[number] = {
        platform: rede,
        accountId,
        customContent: montarConteudo(copy),
      };
      if (rede === 'youtube') {
        platItem.platformSpecificData = dadosEspecificosYoutube(copy, planoFinal);
      }
      platformsPayload.push(platItem);
    }

    if (platformsPayload.length === 0) {
      onLog(`  ⚠️  nenhuma plataforma com conta configurada; pulando.`);
      falhas++;
      continue;
    }

    const conteudoBase = planoFinal.copy[0]?.descricao ?? '';

    const body: Record<string, unknown> = {
      content: conteudoBase,
      platforms: platformsPayload,
    };

    if (dataMudou) {
      body.scheduledFor = dataAgora;
      body.timezone = 'America/Bahia';
    }

    // Atualiza mediaItems mantendo o tipo correto (imagem vs vídeo) baseado
    // no plano. Carrossel injeta N mediaItems (principal + planoFinal.mediasExtras).
    const categoria = categoriaDoTipo(planoFinal.meta.tipo);
    const ehImagem = categoria === 'imagem';
    const mimeFromUrl = (url: string): string => {
      const u = url.toLowerCase();
      if (u.endsWith('.png')) return 'image/png';
      if (u.endsWith('.webp')) return 'image/webp';
      if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
      return 'video/mp4';
    };
    function montarItem(url: string): Record<string, unknown> {
      const item: Record<string, unknown> = {
        type: ehImagem ? 'image' : 'video',
        url,
        mimeType: mimeFromUrl(url),
      };
      if (!ehImagem && planoFinal.thumbnailUrl) {
        item.thumbnail = planoFinal.thumbnailUrl;
        item.instagramThumbnail = planoFinal.thumbnailUrl;
      }
      return item;
    }
    const temCarrossel = (planoFinal.mediasExtras?.length ?? 0) > 0;
    if (ehImagem || planoFinal.thumbnailUrl || temCarrossel) {
      const items = [montarItem(linha.videoUrl)];
      for (const extra of planoFinal.mediasExtras ?? []) {
        items.push(montarItem(extra.urlPublica));
      }
      body.mediaItems = items;
    }

    try {
      const resp = await zernio.posts.updatePost({
        path: { postId: linha.zernioPostId },
        body: body as never,
      });
      const erroResp = (resp as { error?: { message?: string } }).error;
      if (erroResp) {
        onLog(`  ❌ Zernio rejeitou: ${erroResp.message ?? JSON.stringify(erroResp)}`);
        falhas++;
        continue;
      }
      onLog(`  ✅ Zernio atualizado.`);
      atualizados++;

      // Persiste no PlanoJSON a data que acabamos de sincronizar (e qualquer outra
      // edição reconciliada) pra próxima passada do sync detectar deltas corretamente.
      const planoPersistir: PlanoPublicacao = {
        ...planoFinal,
        dataAgendadaEmZernio: dataAgora,
      };
      try {
        await notion.pages.update({
          page_id: linha.pageId,
          properties: {
            PlanoJSON: { rich_text: chunkRichText(JSON.stringify(planoPersistir)) },
          } as never,
        });
      } catch (errPersist) {
        const m = errPersist instanceof Error ? errPersist.message : String(errPersist);
        onLog(`     ⚠️  não consegui persistir PlanoJSON atualizado: ${m}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog(`  ❌ falhou: ${msg}`);
      falhas++;
    }
  }

  onLog(`\n═══════════════════════════════════════`);
  onLog(`FIM ATUALIZAÇÃO ZERNIO. ${atualizados} atualizados, ${semEdicao} sem edição, ${falhas} falhas de ${linhas.length}.`);
  onLog(`═══════════════════════════════════════`);
}
