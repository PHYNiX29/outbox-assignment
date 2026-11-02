/**
 * Standalone worker process. Run as many of these as you like (on any machine) with RUN_WORKER=false
 * on the API: concurrency, the global send-gap limiter and hourly limits are all coordinated through Redis.
 */
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { startWorker } from './queue/worker';
import { initSearch } from './services/search.service';
import { closeTransports } from './services/sender.service';

async function main() {
  await prisma.$connect();
  void initSearch();
  const worker = startWorker();

  const shutdown = async () => {
    logger.info('worker', 'shutting down…');
    await worker.close();
    closeTransports();
    await redis.quit();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  logger.error('worker', 'fatal', err);
  process.exit(1);
});
