import { notionDo } from '../lib/clients';
import type { TenantConfig } from '../config';
import type { Rede, ResultadoPublicacao } from '../types';

function calcularStatusFinal(resultados: ResultadoPublicacao[]): string {
  const pub = resultados.filter((r) => r.status === 'publicado').length;
  const pen = resultados.filter((r) => r.status === 'pendente').length;
  const fal = resultados.filter((r) => r.status === 'falhou').length;
  const age = resultados.filter((r) => r.status === 'agendado').length;
  const total = resultados.length;

  if (age === total) return 'Agendado';
  if (pub === total) return 'Publicado';
  if (fal === total) return 'Falhou';
  if (pen === total) return 'Pendente Zernio';
  if (pub > 0 && pen > 0) return 'Publicado parcial';
  if (pub > 0 && fal > 0) return 'Publicado parcial';
  if (pen > 0) return 'Pendente Zernio';
  return 'Publicado parcial';
}

function montarLog(
  resultados: ResultadoPublicacao[],
  redesIgnoradas: Rede[],
): string {
  const linhas: string[] = [];
  for (const r of resultados) {
    if (r.status === 'publicado') {
      linhas.push(`✅ ${r.rede}${r.url ? ` → ${r.url}` : ''}`);
    } else if (r.status === 'agendado') {
      linhas.push(`📅 ${r.rede}: agendado no Zernio`);
    } else if (r.status === 'pendente') {
      linhas.push(`⏳ ${r.rede}: ${r.erro ?? 'ainda processando no Zernio'}`);
    } else {
      linhas.push(`❌ ${r.rede}: ${r.erro ?? 'erro desconhecido'}`);
    }
  }
  for (const rede of redesIgnoradas) {
    linhas.push(`⏭️  ${rede}: conta não conectada no Zernio (ignorada)`);
  }
  return linhas.join('\n').slice(0, 2000);
}

export async function registrarResultado(
  tenant: TenantConfig,
  pageId: string,
  resultados: ResultadoPublicacao[],
  redesIgnoradas: Rede[],
  zernioPostId?: string,
): Promise<void> {
  const notion = notionDo(tenant);
  const statusFinal = calcularStatusFinal(resultados);
  const log = montarLog(resultados, redesIgnoradas);
  const primeiroLink = resultados.find((r) => r.status === 'publicado' && r.url)?.url;
  const algumPublicado = resultados.some((r) => r.status === 'publicado');

  const properties: Record<string, unknown> = {
    Status: { select: { name: statusFinal } },
    LogPublicacao: { rich_text: [{ text: { content: log || '(vazio)' } }] },
  };
  if (algumPublicado) {
    properties.PublicadoEm = { date: { start: new Date().toISOString() } };
  }
  if (primeiroLink) {
    properties.LinkPublicado = { url: primeiroLink };
  }
  if (zernioPostId) {
    properties.ZernioPostId = {
      rich_text: [{ text: { content: zernioPostId } }],
    };
  }

  await notion.pages.update({
    page_id: pageId,
    properties: properties as Parameters<typeof notion.pages.update>[0]['properties'],
  });
}
