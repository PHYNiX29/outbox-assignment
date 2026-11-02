import { Worker } from 'bullmq';
import { env } from '../config/env';
import { createRedis } from '../lib/redis';
import { logger } from '../lib/logger';
import { EMAIL_QUEUE, type EmailJobData } from './emailQueue';
import { processEmailJob } from './processor';

export function startWorker() {
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE, processEmailJob, {
    connection: createRedis(),
    concurrency: env.WORKER_CONCURRENCY,
    // Note: the min delay between sends is enforced per sender inside the processor (Redis slot
    // reservation) rather than with BullMQ's global limiter, so over-limit jobs can be rescheduled
    // instantly instead of queueing behind the throttle.
    // Stalled-job detection: if a worker dies mid-job, the job is picked up again by another worker.
    stalledInterval: 30_000,
    maxStalledCount: 1,
  });

  worker.on('ready', () =>
    logger.info(
      'worker',
      `ready (concurrency=${env.WORKER_CONCURRENCY}, minDelay=${env.MIN_DELAY_BETWEEN_SENDS_MS}ms, perSenderHourly=${env.MAX_EMAILS_PER_HOUR_PER_SENDER})`,
    ),
  );
  worker.on('failed', (job, err) => logger.warn('worker', `job ${job?.id} failed: ${err.message}`));
  worker.on('error', (err) => logger.error('worker', err.message));

  return worker;
}
