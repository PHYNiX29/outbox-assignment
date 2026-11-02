import type { Worker } from 'bullmq';
import { env } from './config/env';
import { createApp } from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { emailQueue } from './queue/emailQueue';
import { startWorker } from './queue/worker';
import { reconcileScheduledEmails } from './services/reconcile.service';
import { initSearch } from './services/search.service';
import { closeTransports, ensureSenders } from './services/sender.service';

async function main() {
  await prisma.$connect();
  await ensureSenders();
  void initSearch();
  await reconcileScheduledEmails();

  const worker: Worker | null = env.RUN_WORKER ? startWorker() : null;

  const server = createApp().listen(env.PORT, () => {
    logger.info('server', `API on http://localhost:${env.PORT}  |  queue dashboard: http://localhost:${env.PORT}/admin/queues`);
  });

  // Graceful shutdown: stop taking HTTP traffic, let in-flight jobs finish, then close connections.
  // Note: run with `node --import tsx` (npm run dev), not `tsx watch`. On Windows, tsx watch force-kills
  // the child process on Ctrl+C, so in-flight sends would be cut off instead of finishing.
  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) {
      logger.warn('server', 'already shutting down – waiting for in-flight emails to finish');
      return;
    }
    closing = true;
    logger.info('server', `${signal} received – graceful shutdown started`);
    server.close();
    if (worker) {
      const active = await emailQueue.getActiveCount();
      logger.info('server', `waiting for ${active} in-flight job(s) to finish (no new jobs will be picked up)…`);
      await worker.close();
    }
    await emailQueue.close();
    closeTransports();
    await redis.quit();
    await prisma.$disconnect();
    logger.info('server', 'shutdown complete – scheduled jobs remain safely in Redis');
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('server', 'fatal startup error', err);
  process.exit(1);
});
