import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { enqueueEmails } from '../queue/emailQueue';
import { indexEmails, toDoc } from './search.service';
import { HttpError } from '../middleware/error';

export interface ScheduleInput {
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  recipients: { email: string; name?: string | null }[];
  startAt: Date;
  delaySeconds: number;
  hourlyLimit: number | null;
  idempotencyKey?: string;
}

/**
 * Creates a campaign + one Email row per recipient, then enqueues one delayed BullMQ job per email.
 * Recipient i is scheduled at startAt + i * delay.
 */
export async function scheduleCampaign(input: ScheduleInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.campaign.findUnique({
      where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
      include: { _count: { select: { emails: true } } },
    });
    if (existing) return { campaign: existing, count: existing._count.emails, duplicate: true };
  }

  const sender = await prisma.sender.findUnique({ where: { id: input.senderId } });
  if (!sender) throw new HttpError(400, 'Unknown sender');

  // De-duplicate recipients (case-insensitive) while keeping upload order.
  const seen = new Set<string>();
  const recipients = input.recipients.filter((r) => {
    const key = r.email.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const delayMs = input.delaySeconds * 1000;
  const startMs = Math.max(input.startAt.getTime(), Date.now());

  const emails = recipients.map((r, i) => ({
    id: randomUUID(),
    userId: input.userId,
    senderId: sender.id,
    toEmail: r.email.trim().toLowerCase(),
    toName: r.name?.trim() || null,
    subject: input.subject,
    body: input.body,
    seq: i,
    scheduledAt: new Date(startMs + i * delayMs),
  }));

  // DB first (source of truth), then the queue. If enqueueing fails midway, startup reconciliation
  // will enqueue the remaining SCHEDULED rows.
  const campaign = await prisma.$transaction(async (tx) => {
    const c = await tx.campaign.create({
      data: {
        userId: input.userId,
        senderId: sender.id,
        subject: input.subject,
        body: input.body,
        startAt: new Date(startMs),
        delayMs,
        hourlyLimit: input.hourlyLimit,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
    await tx.email.createMany({ data: emails.map((e) => ({ ...e, campaignId: c.id })) });
    return c;
  });

  await enqueueEmails(emails);

  void indexEmails(
    emails.map((e) =>
      toDoc({
        ...e,
        campaignId: campaign.id,
        status: 'SCHEDULED',
        sentAt: null,
        failedReason: null,
        messageId: null,
        previewUrl: null,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        sender,
      }),
    ),
  );

  return { campaign, count: emails.length, duplicate: false };
}
