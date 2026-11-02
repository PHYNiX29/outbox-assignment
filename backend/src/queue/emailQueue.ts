import { Queue } from 'bullmq';
import { env } from '../config/env';
import { createRedis } from '../lib/redis';

export const EMAIL_QUEUE = 'email-send';

export interface EmailJobData {
  emailId: string;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE, {
  connection: createRedis(),
  defaultJobOptions: {
    attempts: env.EMAIL_MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: 5000 },
    // Keep a bounded history so the Bull Board dashboard has something to show.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

/**
 * Enqueue emails as BullMQ delayed jobs.
 * jobId === email row id, so adding the same email twice is a no-op (BullMQ dedupes by jobId).
 * This is what makes startup reconciliation and API retries safe.
 */
export async function enqueueEmails(items: { id: string; scheduledAt: Date }[]): Promise<void> {
  const now = Date.now();
  const CHUNK = 500;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    await emailQueue.addBulk(
      chunk.map((e) => ({
        name: 'send',
        data: { emailId: e.id },
        opts: { jobId: e.id, delay: Math.max(0, e.scheduledAt.getTime() - now) },
      })),
    );
  }
}
