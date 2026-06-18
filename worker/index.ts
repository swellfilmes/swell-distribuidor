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
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { jobs } from '@/src/db/schema';
import { processarIngest, type PayloadIngest } from './handlers/ingest';
import { publicarAprovadosTodas } from './crons/publicarAprovadosTodas';
import { sincronizarEditsTodas } from './crons/sincronizarEditsTodas';
import { atualizarPendentesTodas } from './crons/atualizarPendentesTodas';

const INTERVALO_POLL_MS = 5_000;
const TIMEZONE = 'America/Bahia';

function log(jobId: number | '', etapa: string, msg: string) {
  const hora = new Date().toLocaleTimeString('pt-BR');
  const tag = jobId ? `#${jobId}` : '-';
  console.log(`[${hora}] [worker ${tag}] [${etapa}] ${msg}`);
}

async function claimNextJob(): Promise<typeof jobs.$inferSelect | null> {
  const candidatos = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, 'pending'))
    .orderBy(asc(jobs.criadoEm))
    .limit(1);
  if (candidatos.length === 0) return null;

  const reivindicado = await db
    .update(jobs)
    .set({
      status: 'in_progress',
      iniciadoEm: new Date(),
      atualizadoEm: new Date(),
      tentativas: candidatos[0].tentativas + 1,
    })
    .where(and(eq(jobs.id, candidatos[0].id), eq(jobs.status, 'pending')))
    .returning();
  return reivindicado[0] ?? null;
}

async function rodarUm(): Promise<boolean> {
  const job = await claimNextJob();
  if (!job) return false;

  log(job.id, 'inicio', `tipo=${job.tipo} empresa=${job.empresaId}`);

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
    log(job.id, 'erro', `❌ ${msg.split('\n')[0]}`);
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
  return true;
}

async function loopDeJobs() {
  log('', 'jobs', `polling a cada ${INTERVALO_POLL_MS / 1000}s...`);
  while (true) {
    try {
      const processou = await rodarUm();
      if (!processou) {
        await new Promise((r) => setTimeout(r, INTERVALO_POLL_MS));
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

  // atualizar-pendentes: diariamente às 12:00
  new Cron('0 12 * * *', { timezone: TIMEZONE, protect: true }, async () => {
    try {
      await atualizarPendentesTodas();
    } catch (err) {
      console.error('[cron atualizar-pendentes] crash:', err);
    }
  });

  log('', 'cron', '✅ schedules ativos: publicar (*/5min) · sincronizar (*/10min) · atualizar (12h)');
}

async function main() {
  log('', 'boot', 'worker subindo...');
  registrarCrons();
  await loopDeJobs();
}

main().catch((err) => {
  console.error('\n💥 Worker morreu de vez:');
  console.error(err);
  process.exit(1);
});
