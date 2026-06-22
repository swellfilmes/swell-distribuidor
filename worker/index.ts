/**
 * Worker do Swell Distribuidor.
 *
 * Faz duas coisas num só processo:
 *   1. Polling na tabela `jobs` (uploads do app)
 *   2. Schedules cron multi-empresa (publicar/sincronizar/atualizar)
 *
 * Local (dev): `npm run worker` em outro terminal.
 * Produção (F2.6+): rodando no Railway como serviço persistente.
 */
import { Cron } from 'croner';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/src/db';
import { jobs } from '@/src/db/schema';
import { processarIngest, type PayloadIngest } from './handlers/ingest';
import { publicarAprovadosTodas } from './crons/publicarAprovadosTodas';
import { sincronizarEditsTodas } from './crons/sincronizarEditsTodas';
import { atualizarPendentesTodas } from './crons/atualizarPendentesTodas';

const INTERVALO_POLL_MS = 5_000;
const MAX_CONCURRENCY = 1;
const MAX_TENTATIVAS = 3;
const TIMEZONE = 'America/Bahia';

function log(jobId: number | '', etapa: string, msg: string) {
  const hora = new Date().toLocaleTimeString('pt-BR');
  const tag = jobId ? `#${jobId}` : '-';
  console.log(`[${hora}] [worker ${tag}] [${etapa}] ${msg}`);
}

/**
 * Reivindica até N jobs pendentes atomicamente. Cada UPDATE checa `status=pending`
 * de novo na WHERE, então 2 workers concorrentes nunca pegam o mesmo job.
 */
async function claimNextBatch(n: number): Promise<Array<typeof jobs.$inferSelect>> {
  const candidatos = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, 'pending'))
    .orderBy(asc(jobs.criadoEm))
    .limit(n);
  if (candidatos.length === 0) return [];

  const reivindicados: Array<typeof jobs.$inferSelect> = [];
  for (const cand of candidatos) {
    const r = await db
      .update(jobs)
      .set({
        status: 'in_progress',
        iniciadoEm: new Date(),
        atualizadoEm: new Date(),
        tentativas: cand.tentativas + 1,
      })
      .where(and(eq(jobs.id, cand.id), eq(jobs.status, 'pending')))
      .returning();
    if (r[0]) reivindicados.push(r[0]);
  }
  return reivindicados;
}

async function rodar(job: typeof jobs.$inferSelect): Promise<void> {
  log(job.id, 'inicio', `tipo=${job.tipo} empresa=${job.empresaId} tentativa=${job.tentativas}`);

  try {
    if (job.tipo === 'ingest') {
      const payload = job.payload as PayloadIngest;
      const logs: string[] = [];
      const onLog = (m: string) => {
        logs.push(m);
        log(job.id, 'ingest', m);
      };
      const resultado = await processarIngest(job.empresaId, payload, onLog);

      await db
        .update(jobs)
        .set({
          status: 'done',
          result: { ...resultado, logs } as never,
          atualizadoEm: new Date(),
          finalizadoEm: new Date(),
        })
        .where(eq(jobs.id, job.id));

      log(job.id, 'fim', `✅ done (pageId=${resultado.pageId})`);
    } else {
      throw new Error(`tipo desconhecido: ${job.tipo}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    const podeRetentar = job.tentativas < MAX_TENTATIVAS;
    if (podeRetentar) {
      log(job.id, 'retry', `❌ ${msg.split('\n')[0]} → tentativa ${job.tentativas}/${MAX_TENTATIVAS}, voltando pra pending`);
      await db
        .update(jobs)
        .set({
          status: 'pending',
          erro: msg,
          atualizadoEm: new Date(),
          iniciadoEm: null,
        })
        .where(eq(jobs.id, job.id));
    } else {
      log(job.id, 'fail', `❌ ${msg.split('\n')[0]} → falhou em definitivo após ${MAX_TENTATIVAS} tentativas`);
      await db
        .update(jobs)
        .set({
          status: 'failed',
          erro: msg,
          atualizadoEm: new Date(),
          finalizadoEm: new Date(),
        })
        .where(eq(jobs.id, job.id));
    }
  }
}

/**
 * Loop que mantém até MAX_CONCURRENCY jobs rodando em paralelo.
 * Cada slot pega um job, processa, libera o slot. Quando todos slots livres
 * e fila vazia, dorme INTERVALO_POLL_MS.
 */
async function loopDeJobs() {
  log('', 'jobs', `polling a cada ${INTERVALO_POLL_MS / 1000}s (concorrência ${MAX_CONCURRENCY})...`);

  const ativos = new Set<Promise<void>>();
  // dedupe: ids já em processamento (defensivo extra)
  const idsAtivos = new Set<number>();

  while (true) {
    try {
      const podemPegar = MAX_CONCURRENCY - ativos.size;
      if (podemPegar > 0) {
        const novos = await claimNextBatch(podemPegar);
        const filtrados = novos.filter((j) => !idsAtivos.has(j.id));
        for (const job of filtrados) {
          idsAtivos.add(job.id);
          const p = rodar(job).finally(() => {
            idsAtivos.delete(job.id);
            ativos.delete(p);
          });
          ativos.add(p);
        }
      }

      if (ativos.size === 0) {
        await new Promise((r) => setTimeout(r, INTERVALO_POLL_MS));
      } else {
        // Espera o próximo terminar OU 1s, o que vier antes — pra reagir
        // rapidamente quando um slot abre e tem mais coisa na fila.
        await Promise.race([
          Promise.race([...ativos]),
          new Promise((r) => setTimeout(r, 1_000)),
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('', 'fatal-jobs', `loop crashou: ${msg}. retry em 10s...`);
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
}

function registrarCrons() {
  log('', 'cron', 'registrando 3 schedules em fuso America/Bahia...');

  // publicar-aprovados: a cada 5min
  new Cron('*/5 * * * *', { timezone: TIMEZONE, protect: true }, async () => {
    try {
      await publicarAprovadosTodas();
    } catch (err) {
      console.error('[cron publicar-aprovados] crash:', err);
    }
  });

  // sincronizar-edits: a cada 10min
  new Cron('*/10 * * * *', { timezone: TIMEZONE, protect: true }, async () => {
    try {
      await sincronizarEditsTodas();
    } catch (err) {
      console.error('[cron sincronizar-edits] crash:', err);
    }
  });

  // atualizar-pendentes: a cada 15min (inclui transição Agendado → Publicado)
  new Cron('*/15 * * * *', { timezone: TIMEZONE, protect: true }, async () => {
    try {
      await atualizarPendentesTodas();
    } catch (err) {
      console.error('[cron atualizar-pendentes] crash:', err);
    }
  });

  log('', 'cron', '✅ schedules ativos: publicar (*/5min) · sincronizar (*/10min) · atualizar (*/15min)');
}

async function main() {
  log('', 'boot', `worker subindo... (concorrência=${MAX_CONCURRENCY}, max tentativas=${MAX_TENTATIVAS})`);
  registrarCrons();
  // Reset de jobs `in_progress` órfãos (vieram de boot anterior que crashou)
  try {
    await db
      .update(jobs)
      .set({ status: 'pending', iniciadoEm: null, atualizadoEm: new Date() })
      .where(inArray(jobs.status, ['in_progress']));
    log('', 'boot', 'jobs órfãos resetados pra pending.');
  } catch (err) {
    log('', 'boot', `aviso: reset de órfãos falhou: ${err instanceof Error ? err.message : String(err)}`);
  }
  await loopDeJobs();
}

main().catch((err) => {
  console.error('\n💥 Worker morreu de vez:');
  console.error(err);
  process.exit(1);
});
