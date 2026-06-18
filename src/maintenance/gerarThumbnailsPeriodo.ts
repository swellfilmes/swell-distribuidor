import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { contaConfiguradaPara, notionDo, zernioDo } from '../lib/clients';
import { extrairFrames, extrairFrameHiRes } from '../ingest/extrairFrames';
import { avaliarFramesParaThumbnail } from '../brain/thumbnailAgent';
import { subirParaR2 } from '../storage/r2';
import { chunkRichText } from '../lib/notionChunks';
import type { TenantConfig } from '../config';
import type { PlanoPublicacao } from '../types';

interface LinhaPraThumbnail {
  pageId: string;
  nome: string;
  plano: PlanoPublicacao;
  videoUrl: string;
  status: string;
  zernioPostId: string;
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

function lerSelect(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; select?: { name?: string } | null };
  if (p.type !== 'select' || !p.select?.name) return '';
  return p.select.name;
}

function lerDateStart(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; date?: { start?: string | null } | null };
  if (p.type !== 'date' || !p.date?.start) return '';
  return p.date.start;
}

async function buscarLinhasPeriodo(
  tenant: TenantConfig,
  de: string,
  ate: string,
): Promise<LinhaPraThumbnail[]> {
  const notion = notionDo(tenant);
  const linhas: LinhaPraThumbnail[] = [];
  let cursor: string | undefined;

  do {
    const resp = await notion.databases.query({
      database_id: tenant.notionDbId,
      start_cursor: cursor,
      filter: {
        and: [
          { property: 'DataPublicacao', date: { on_or_after: de } },
          { property: 'DataPublicacao', date: { on_or_before: ate } },
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
      const videoUrl = lerUrl(props['Video']);
      if (!videoUrl) continue;
      linhas.push({
        pageId: page.id,
        nome: lerTitle(props['Nome']) || '(sem nome)',
        plano,
        videoUrl,
        status: lerSelect(props['Status']),
        zernioPostId: lerRichText(props['ZernioPostId']),
        dataPublicacao: lerDateStart(props['DataPublicacao']),
      });
    }
    cursor = resp.has_more ? resp.next_cursor ?? undefined : undefined;
  } while (cursor);

  return linhas;
}

async function baixarVideoTmp(url: string): Promise<{ caminho: string; limpar: () => Promise<void> }> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'swell-thumb-vid-'));
  const caminho = path.join(tmpDir, 'video.mp4');
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download falhou: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  await writeFile(caminho, buffer);
  return { caminho, limpar: async () => rm(tmpDir, { recursive: true, force: true }) };
}

async function escolherMelhorFrame(
  caminhoVideo: string,
  plano: PlanoPublicacao,
  onLog: (msg: string) => void,
): Promise<{ timestampSeg: number; score: number; justificativa: string }> {
  onLog(`    📸 round 1: extraindo 6 frames padrão...`);
  const round1 = await extrairFrames(caminhoVideo, 6);
  onLog(`    🧠 avaliando os 6 frames...`);
  const av1 = await avaliarFramesParaThumbnail(plano, round1);
  onLog(`       melhor=${av1.melhorIndice} score=${av1.scoreMelhor}/10 (${av1.justificativa})`);

  if (!av1.precisaMaisFrames && av1.scoreMelhor >= 7) {
    return {
      timestampSeg: round1[av1.melhorIndice].timestampSeg,
      score: av1.scoreMelhor,
      justificativa: av1.justificativa,
    };
  }

  // Round 2: 6 frames adicionais em timestamps deslocados
  const tsExistentes = round1.map((f) => f.timestampSeg);
  const passoMedio = tsExistentes.length > 1 ? tsExistentes[1] - tsExistentes[0] : 5;
  const tsNovos = tsExistentes.map((ts) => ts - passoMedio / 2).filter((ts) => ts > 0.5);
  while (tsNovos.length < 6) tsNovos.push(tsExistentes[tsExistentes.length - 1] + passoMedio / 2);

  onLog(`    📸 round 2: nenhum frame chegou a 7; extraindo 6 novos em timestamps deslocados...`);
  const round2 = await extrairFrames(caminhoVideo, 6, { timestampsExplicitos: tsNovos });
  const todos = [...round1, ...round2];
  onLog(`    🧠 reavaliando os 12 frames...`);
  const av2 = await avaliarFramesParaThumbnail(plano, todos);
  onLog(`       melhor=${av2.melhorIndice} score=${av2.scoreMelhor}/10 (${av2.justificativa})`);

  return {
    timestampSeg: todos[av2.melhorIndice].timestampSeg,
    score: av2.scoreMelhor,
    justificativa: av2.justificativa,
  };
}

async function atualizarLinha(
  tenant: TenantConfig,
  pageId: string,
  planoAtualizado: PlanoPublicacao,
  thumbnailUrl: string,
): Promise<void> {
  const notion = notionDo(tenant);
  await notion.pages.update({
    page_id: pageId,
    properties: {
      ThumbnailUrl: { url: thumbnailUrl },
      PlanoJSON: { rich_text: chunkRichText(JSON.stringify(planoAtualizado)) },
    } as never,
  });
}

async function atualizarZernioComThumbnail(
  tenant: TenantConfig,
  zernioPostId: string,
  videoUrl: string,
  thumbnailUrl: string,
  plano: PlanoPublicacao,
): Promise<{ ok: boolean; erro?: string }> {
  const zernio = zernioDo(tenant);
  const platformsPayload: Array<Record<string, unknown>> = [];
  for (const rede of plano.redes) {
    const accountId = contaConfiguradaPara(tenant, rede);
    if (!accountId) continue;
    platformsPayload.push({ platform: rede, accountId });
  }
  if (platformsPayload.length === 0) {
    return { ok: false, erro: 'nenhuma conta configurada' };
  }

  try {
    const resp = await zernio.posts.updatePost({
      path: { postId: zernioPostId },
      body: {
        mediaItems: [
          {
            type: 'video',
            url: videoUrl,
            mimeType: 'video/mp4',
            thumbnail: thumbnailUrl,
            instagramThumbnail: thumbnailUrl,
          },
        ],
        platforms: platformsPayload,
      } as never,
    });
    const erroResp = (resp as { error?: { message?: string } }).error;
    if (erroResp) return { ok: false, erro: erroResp.message ?? JSON.stringify(erroResp) };
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}

export async function gerarThumbnailsPeriodo(
  tenant: TenantConfig,
  de: string,
  ate: string,
  onLog: (msg: string) => void = (m) => console.log(m),
): Promise<void> {
  onLog(`Buscando linhas com DataPublicacao entre ${de} e ${ate}...`);
  const linhas = await buscarLinhasPeriodo(tenant, de, ate);
  onLog(`Encontradas ${linhas.length} linha(s) no período.`);
  if (linhas.length === 0) return;

  let ok = 0;
  let zernioOk = 0;
  let falhas = 0;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    onLog(`\n[${i + 1}/${linhas.length}] ${linha.nome}  (${linha.dataPublicacao}, ${linha.status})`);

    try {
      onLog(`  ⬇️  baixando vídeo do R2...`);
      const baixado = await baixarVideoTmp(linha.videoUrl);
      try {
        const escolha = await escolherMelhorFrame(baixado.caminho, linha.plano, onLog);

        onLog(`  🖼️   extraindo frame em alta resolução @ ${escolha.timestampSeg.toFixed(1)}s...`);
        const hiRes = await extrairFrameHiRes(baixado.caminho, escolha.timestampSeg);
        try {
          onLog(`  ☁️  subindo thumbnail no R2...`);
          const midia = await subirParaR2(tenant, hiRes.caminhoArquivo);
          onLog(`     ${midia.urlPublica}`);

          const planoComThumb: PlanoPublicacao = { ...linha.plano, thumbnailUrl: midia.urlPublica };
          await atualizarLinha(tenant, linha.pageId, planoComThumb, midia.urlPublica);
          onLog(`  ✅ Notion atualizado.`);
          ok++;

          if (linha.status === 'Agendado' && linha.zernioPostId) {
            onLog(`  📤 propagando thumbnail pro Zernio (post agendado)...`);
            const r = await atualizarZernioComThumbnail(
              tenant,
              linha.zernioPostId,
              linha.videoUrl,
              midia.urlPublica,
              planoComThumb,
            );
            if (r.ok) {
              onLog(`     ✅ Zernio atualizado.`);
              zernioOk++;
            } else {
              onLog(`     ⚠️  Zernio: ${r.erro}`);
            }
          }
        } finally {
          await hiRes.limpar();
        }
      } finally {
        await baixado.limpar();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog(`  ❌ falhou: ${msg}`);
      falhas++;
    }
  }

  onLog(`\n═══════════════════════════════════════`);
  onLog(`FIM THUMBNAILS. ${ok} linhas com thumbnail, ${zernioOk} propagadas pro Zernio, ${falhas} falhas de ${linhas.length}.`);
  onLog(`═══════════════════════════════════════`);
}
