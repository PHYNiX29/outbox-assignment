import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { enqueueEmails } from '../queue/emailQueue';

/**
 * Runs on every boot. Redis (with AOF) normally keeps all delayed jobs across restarts, but the DB is
 * the source of truth: every SCHEDULED row is re-enqueued with jobId = row id. Jobs that already
 * exist are ignored by BullMQ, so this never creates duplicates; it only heals jobs lost if Redis
 * itself lost data. Overdue rows get delay 0 and are sent right away (still subject to limits).
 */
export async function reconcileScheduledEmails(): Promise<void> {
  const PAGE = 1000;
  let cursor: string | undefined;
  let total = 0;

  for (;;) {
    const rows = await prisma.email.findMany({
      where: { status: 'SCHEDULED' },
      select: { id: true, scheduledAt: true },
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    await enqueueEmails(rows);
    total += rows.length;
    cursor = rows[rows.length - 1].id;
  }

  logger.info('reconcile', `verified ${total} scheduled email(s) are queued`);
}
