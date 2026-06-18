import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseNome } from './ingest/parseNome';
import { extrairFrames } from './ingest/extrairFrames';
import { gerarPlano } from './brain/cerebro';
import { polirCopy } from './brain/redator';
import { gerarThumbnailDoVideoLocal } from './brain/gerarThumbnail';
import { reconciliarPlanoComNotion } from './lib/reconciliarCopy';
import { subirParaR2 } from './storage/r2';
import {
  aguardarDecisao,
  criarLinhaAprovacao,
} from './approval/notion';
import {
  listarContasConectadas,
  publicarTudo,
} from './publish/zernio';
import { registrarResultado } from './log/notion';
import { atualizarPendentes } from './maintenance/atualizarPendentes';
import { publicarAprovados } from './maintenance/publicarAprovados';
import { ingerirPasta } from './maintenance/ingerirPasta';
import { avaliarCopyTodas } from './maintenance/avaliarCopy';
import { agendarTodas } from './maintenance/agendarTodas';
import { repararCopyQuebradas } from './maintenance/repararCopy';
import { atualizarZernioAgendadosAte } from './maintenance/atualizarZernioAgendados';
import { gerarThumbnailsPeriodo } from './maintenance/gerarThumbnailsPeriodo';
import { loadTenantConfig, listarEmpresasAtivas } from './db/tenantConfig';
import type { TenantConfig } from './config';

function log(etapa: string, msg: string) {
  const hora = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${hora}] [${etapa}] ${msg}`);
}

function uso() {
  console.log('Uso:');
  console.log('  npm run distribuir -- [--empresa <slug>] ./caminho/video.mp4');
  console.log('  npm run distribuir -- --listar-empresas');
  console.log('  npm run distribuir -- [--empresa <slug>] --listar-contas');
  console.log('  npm run distribuir -- [--empresa <slug>] --atualizar-pendentes');
  console.log('  npm run distribuir -- [--empresa <slug>] --publicar-aprovados');
  console.log('  npm run distribuir -- [--empresa <slug>] --ingerir-pasta <caminho-local> [--max N] [--apenas-listar]');
  console.log('  npm run distribuir -- [--empresa <slug>] --avaliar-copy');
  console.log('  npm run distribuir -- [--empresa <slug>] --agendar-todas');
  console.log('');
  console.log('Se --empresa não for passado, usa "swell" como padrão.');
}

/**
 * Extrai o slug da empresa dos argv (e o remove da lista) — aceita
 * `--empresa swell` em qualquer posição. Default: 'swell'.
 */
function extrairEmpresa(argv: string[]): { slug: string; resto: string[] } {
  const idx = argv.indexOf('--empresa');
  if (idx === -1) return { slug: 'swell', resto: argv };
  const slug = argv[idx + 1];
  if (!slug) {
    console.error('❌ --empresa precisa de um slug. Ex: --empresa swell');
    process.exit(1);
  }
  const resto = [...argv.slice(0, idx), ...argv.slice(idx + 2)];
  return { slug, resto };
}

async function main() {
  const todoArgv = process.argv.slice(2);

  if (todoArgv.length === 0 || todoArgv[0] === '--help' || todoArgv[0] === '-h') {
    uso();
    process.exit(0);
  }

  // --listar-empresas não precisa de tenant
  if (todoArgv[0] === '--listar-empresas') {
    const empresas = await listarEmpresasAtivas();
    if (empresas.length === 0) {
      console.log('Nenhuma empresa cadastrada ainda.');
      console.log('Rode: npx tsx scripts/migrate-swell-tenant.ts pra criar a Swell.');
      return;
    }
    console.log('\nEmpresas ativas:');
    for (const e of empresas) {
      console.log(`  ${e.slug.padEnd(20)} → ${e.nome}  (id=${e.id})`);
    }
    return;
  }

  const { slug, resto: argv } = extrairEmpresa(todoArgv);
  log('tenant', `carregando empresa "${slug}"...`);
  let tenant: TenantConfig;
  try {
    tenant = await loadTenantConfig(slug);
  } catch (err) {
    console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
  log('tenant', `ok: ${tenant.nome} (id=${tenant.empresaId}).`);

  const arg = argv[0];

  if (arg === '--listar-contas') {
    await listarContasConectadas(tenant);
    return;
  }

  if (arg === '--atualizar-pendentes') {
    await atualizarPendentes(tenant, (msg) => log('atualizar', msg));
    return;
  }

  if (arg === '--publicar-aprovados') {
    await publicarAprovados(tenant, (msg) => log('agendar', msg));
    return;
  }

  if (arg === '--reparar-copy') {
    await repararCopyQuebradas(tenant, (msg) => log('reparar', msg));
    return;
  }

  if (arg === '--atualizar-zernio-ate') {
    const ate = argv[1];
    if (!ate) {
      console.error('❌ Faltou a data. Uso: --atualizar-zernio-ate YYYY-MM-DD');
      process.exit(1);
    }
    await atualizarZernioAgendadosAte(tenant, ate, (msg) => log('zernio', msg));
    return;
  }

  if (arg === '--sincronizar-edits-zernio') {
    await atualizarZernioAgendadosAte(tenant, undefined, (msg) => log('sync', msg));
    return;
  }

  if (arg === '--gerar-thumbnails') {
    const de = argv[1];
    const ate = argv[2];
    if (!de || !ate) {
      console.error('❌ Uso: --gerar-thumbnails YYYY-MM-DD YYYY-MM-DD');
      process.exit(1);
    }
    await gerarThumbnailsPeriodo(tenant, de, ate, (msg) => log('thumb', msg));
    return;
  }

  if (arg === '--avaliar-copy') {
    await avaliarCopyTodas(tenant, (msg) => log('avaliar', msg));
    return;
  }

  if (arg === '--agendar-todas') {
    await agendarTodas(tenant, (msg) => log('agendar', msg));
    return;
  }

  if (arg === '--ingerir-pasta') {
    const caminho = argv[1];
    if (!caminho) {
      console.error('❌ Faltou o caminho. Uso: --ingerir-pasta <pasta> [--max N] [--apenas-listar] [--ignorar "TERMO1,TERMO2"]');
      process.exit(1);
    }
    const rest = argv.slice(2);
    const maxIdx = rest.indexOf('--max');
    const max = maxIdx >= 0 ? parseInt(rest[maxIdx + 1], 10) : undefined;
    const ignorarIdx = rest.indexOf('--ignorar');
    const ignorar = ignorarIdx >= 0
      ? rest[ignorarIdx + 1].split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const apenasListar = rest.includes('--apenas-listar');
    await ingerirPasta(tenant, caminho, { max, apenasListar, ignorar }, (msg) => log('ingerir', msg));
    return;
  }

  const caminho = path.resolve(arg);
  if (!existsSync(caminho)) {
    console.error(`❌ Arquivo não encontrado: ${caminho}`);
    process.exit(1);
  }

  log('ingest', `lendo nome do arquivo: ${path.basename(caminho)}`);
  const meta = parseNome(caminho);
  log(
    'ingest',
    `cliente=${meta.cliente} tipo=${meta.tipo} orientacao=${meta.orientacao}`,
  );

  log('ingest', 'extraindo 6 frames do vídeo...');
  const frames = await extrairFrames(caminho, 6);
  log('ingest', `${frames.length} frames extraídos.`);

  log('brain', 'chamando Claude (Sonnet 4.6) com os frames + meta...');
  const planoBruto = await gerarPlano(meta, frames);
  log('brain', `redes escolhidas: ${planoBruto.redes.join(', ')}`);
  log('brain', `conteudoAI=${planoBruto.conteudoAI}`);
  log('brain', `resumo: ${planoBruto.resumoInterno}`);

  log('redator', 'polindo copy no tom Swell...');
  const planoPolido = await polirCopy(planoBruto, frames);

  let plano = planoPolido;
  try {
    log('thumb', 'gerando thumbnail...');
    const thumb = await gerarThumbnailDoVideoLocal(tenant, caminho, planoPolido, (msg) => log('thumb', msg));
    plano = { ...planoPolido, thumbnailUrl: thumb.thumbnailUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('thumb', `⚠️  thumbnail falhou (sigo sem): ${msg}`);
  }

  log('storage', 'subindo vídeo pro R2...');
  const midia = await subirParaR2(tenant, caminho);
  log('storage', `URL pública: ${midia.urlPublica}`);

  log('approval', 'criando linha no Notion...');
  const linha = await criarLinhaAprovacao(tenant, plano, midia);
  log('approval', `linha criada: ${linha.url}`);
  log(
    'approval',
    'aguardando você marcar Status=Aprovado ou Rejeitado no Notion...',
  );

  const decisao = await aguardarDecisao(tenant, linha.pageId);

  if (decisao.status === 'Rejeitado') {
    log('approval', '❌ rejeitado no Notion. Encerrando sem publicar.');
    return;
  }

  log('approval', '✅ aprovado.');

  const { plano: planoFinal, redesEditadas } = await reconciliarPlanoComNotion(
    tenant,
    linha.pageId,
    plano,
  );
  if (redesEditadas.length) {
    log('approval', `✏️  detectei suas edições no Notion: ${redesEditadas.join(', ')} (uso essas, não a copy original)`);
  }

  if (decisao.dataPublicacao) {
    log('publish', `agendando no Zernio para ${decisao.dataPublicacao}...`);
  } else {
    log('publish', 'publicando via Zernio agora (sem DataPublicacao definida)...');
  }

  const { resultados, redesIgnoradas, zernioPostId } = await publicarTudo(
    tenant,
    planoFinal,
    midia,
    {
      scheduledFor: decisao.dataPublicacao,
      onTick: (msg) => log('publish', msg),
    },
  );

  for (const r of resultados) {
    if (r.status === 'publicado') {
      log('publish', `✅ ${r.rede}${r.url ? ` → ${r.url}` : ''}`);
    } else if (r.status === 'agendado') {
      log('publish', `📅 ${r.rede}: agendado`);
    } else if (r.status === 'pendente') {
      log('publish', `⏳ ${r.rede}: ${r.erro}`);
    } else {
      log('publish', `❌ ${r.rede}: ${r.erro}`);
    }
  }
  for (const rede of redesIgnoradas) {
    log('publish', `⏭️  ${rede} ignorada (conta não conectada).`);
  }

  log('log', 'atualizando linha no Notion com resultado...');
  await registrarResultado(tenant, linha.pageId, resultados, redesIgnoradas, zernioPostId);
  log('log', '✅ histórico atualizado.');

  if (resultados.some((r) => r.status === 'pendente')) {
    log('fim', 'algumas redes ainda em processing — rode `npm run distribuir -- --atualizar-pendentes` mais tarde pra refrescar.');
  }

  log('fim', 'Fluxo concluído.');
}

main().catch((err) => {
  console.error('\n💥 Erro no fluxo:');
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
