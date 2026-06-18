import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { notionDo } from '../lib/clients';
import { gerarPlano } from '../brain/cerebro';
import { polirCopy } from '../brain/redator';
import { avaliarECorrigir } from '../brain/avaliador';
import { extrairFrames } from '../ingest/extrairFrames';
import { chunkRichText } from '../lib/notionChunks';
import type { TenantConfig } from '../config';
import type {
  MetaArquivo,
  Orientacao,
  PlanoPublicacao,
  Rede,
  TipoVideo,
} from '../types';

interface LinhaQuebrada {
  pageId: string;
  nome: string;
  cliente: string;
  tipo: TipoVideo;
  orientacao: Orientacao;
  redes: Rede[];
  conteudoAI: boolean;
  resumo: string;
  videoUrl: string;
  nomeArquivo: string;
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

function lerSelect(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; select?: { name?: string } | null };
  if (p.type !== 'select' || !p.select?.name) return '';
  return p.select.name;
}

function lerMultiSelect(prop: unknown): string[] {
  if (!prop || typeof prop !== 'object') return [];
  const p = prop as { type?: string; multi_select?: Array<{ name?: string }> };
  if (p.type !== 'multi_select' || !p.multi_select) return [];
  return p.multi_select.map((s) => s.name ?? '').filter(Boolean);
}

function lerUrl(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; url?: string | null };
  if (p.type !== 'url' || !p.url) return '';
  return p.url;
}

function lerCheckbox(prop: unknown): boolean {
  if (!prop || typeof prop !== 'object') return false;
  const p = prop as { type?: string; checkbox?: boolean };
  return p.type === 'checkbox' && p.checkbox === true;
}

async function buscarLinhasQuebradas(
  tenant: TenantConfig,
): Promise<LinhaQuebrada[]> {
  const notion = notionDo(tenant);
  const quebradas: LinhaQuebrada[] = [];
  let cursor: string | undefined;

  do {
    const resp = await notion.databases.query({
      database_id: tenant.notionDbId,
      start_cursor: cursor,
      filter: { property: 'Status', select: { equals: 'Aguardando' } },
      page_size: 100,
    });

    for (const page of resp.results) {
      if (!('properties' in page)) continue;
      const props = page.properties;
      const planoStr = lerRichText(props['PlanoJSON']);

      let parseFalhou = false;
      try {
        JSON.parse(planoStr);
      } catch {
        parseFalhou = true;
      }
      if (!parseFalhou) continue;

      const cliente = lerRichText(props['Cliente']);
      const tipo = lerSelect(props['Tipo']) as TipoVideo;
      const orientacao = lerSelect(props['Orientacao']) as Orientacao;
      const redes = lerMultiSelect(props['Redes']) as Rede[];
      const conteudoAI = lerCheckbox(props['ConteudoAI']);
      const resumo = lerRichText(props['Resumo']);
      const videoUrl = lerUrl(props['Video']);
      const nome = lerTitle(props['Nome']) || '(sem nome)';
      const nomeArquivo = nome.split(' — ').pop() ?? nome;

      if (!cliente || !tipo || !orientacao || !videoUrl) continue;

      quebradas.push({
        pageId: page.id,
        nome,
        cliente,
        tipo,
        orientacao,
        redes,
        conteudoAI,
        resumo,
        videoUrl,
        nomeArquivo,
      });
    }

    cursor = resp.has_more ? resp.next_cursor ?? undefined : undefined;
  } while (cursor);

  return quebradas;
}

async function baixarVideoTmp(url: string): Promise<{ caminho: string; limpar: () => Promise<void> }> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'swell-repair-'));
  const caminho = path.join(tmpDir, 'video.mp4');
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download falhou: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  await writeFile(caminho, buffer);
  return {
    caminho,
    limpar: async () => rm(tmpDir, { recursive: true, force: true }),
  };
}

async function atualizarLinha(
  tenant: TenantConfig,
  pageId: string,
  plano: PlanoPublicacao,
): Promise<void> {
  const notion = notionDo(tenant);
  const copyResumo = plano.copy.map((c) => `[${c.rede}] ${c.descricao}`).join('\n\n');
  const planoJson = JSON.stringify(plano);

  await notion.pages.update({
    page_id: pageId,
    properties: {
      Copy: { rich_text: chunkRichText(copyResumo) },
      PlanoJSON: { rich_text: chunkRichText(planoJson) },
    } as never,
  });
}

export async function repararCopyQuebradas(
  tenant: TenantConfig,
  onLog: (msg: string) => void = (m) => console.log(m),
): Promise<void> {
  onLog('Buscando linhas Aguardando com PlanoJSON quebrado...');
  const linhas = await buscarLinhasQuebradas(tenant);
  onLog(`Encontradas ${linhas.length} linha(s) quebradas.`);
  if (linhas.length === 0) return;

  let ok = 0;
  let falhou = 0;

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    onLog(`\n[${i + 1}/${linhas.length}] ${l.nome}`);

    try {
      onLog(`  ⬇️  baixando do R2...`);
      const baixado = await baixarVideoTmp(l.videoUrl);
      try {
        onLog(`  🔍  extraindo 6 frames...`);
        const frames = await extrairFrames(baixado.caminho, 6);

        const meta: MetaArquivo = {
          cliente: l.cliente,
          tipo: l.tipo,
          orientacao: l.orientacao,
          caminhoLocal: baixado.caminho,
          nomeArquivo: l.nomeArquivo,
        };

        onLog(`  🧠  cérebro (Sonnet 4.6) gerando copy...`);
        const planoBruto = await gerarPlano(meta, frames);

        onLog(`  ✍️   redator polindo no tom Swell...`);
        const planoPolido = await polirCopy(planoBruto, frames);

        onLog(`  🎯  avaliador-corretor pra 10/10...`);
        const { planoMelhorado, avaliacoes } = await avaliarECorrigir(planoPolido);
        for (const a of avaliacoes) {
          onLog(`    ${a.rede}: ${a.notaAntes} → ${a.notaDepois}`);
        }

        await atualizarLinha(tenant, l.pageId, planoMelhorado);
        onLog(`  ✅ Notion atualizado.`);
        ok++;
      } finally {
        await baixado.limpar();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog(`  ❌ falhou: ${msg}`);
      falhou++;
    }
  }

  onLog(`\n═══════════════════════════════════════`);
  onLog(`FIM REPARO. ${ok} reparadas, ${falhou} falhas de ${linhas.length}.`);
  onLog(`═══════════════════════════════════════`);
}
