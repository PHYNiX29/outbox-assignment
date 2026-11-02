import { DelayedError, type Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { env, features } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { getTransport } from '../services/sender.service';
import { updateEmailDoc } from '../services/search.service';
import { notifyRateLimit } from '../services/slack.service';
import { htmlToText } from '../utils/text';
import type { EmailJobData } from './emailQueue';
import { markLimitNotified, nextWindowSlot, releaseSendSlot, reserveSenderGapSlot, reserveSendSlot } from './rateLimiter';

// Builds the full message (and a Message-ID) without opening any network connection.
const simulatedTransport = nodemailer.createTransport({ jsonTransport: true });

type Result = { status: 'sent' | 'skipped' | 'failed'; reason?: string; previewUrl?: string | null };

/**
 * Processes one email job.
 *
 * Idempotency: the DB row is the source of truth. A job only sends if it can atomically flip the
 * row SCHEDULED -> SENDING (conditional UPDATE). Duplicate jobs, retries after completion, or
 * re-enqueues after restart all hit `count === 0` and are skipped.
 */
export async function processEmailJob(job: Job<EmailJobData>, token?: string): Promise<Result> {
  const { emailId } = job.data;
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { sender: true, campaign: { select: { hourlyLimit: true, delayMs: true } } },
  });

  if (!email) return { status: 'skipped', reason: 'email row not found' };
  if (email.status === 'SENT' || email.status === 'FAILED') {
    return { status: 'skipped', reason: `already ${email.status.toLowerCase()}` };
  }
  if (email.status === 'SENDING') {
    // A previous worker crashed after claiming but before recording the result. The SMTP server may
    // or may not have accepted the message; we choose at-most-once delivery (never duplicate).
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'FAILED', failedReason: 'Interrupted during send; not retried to avoid a duplicate' },
    });
    await updateEmailDoc(emailId, { status: 'failed' });
    return { status: 'failed', reason: 'interrupted' };
  }

  // ---- Hourly rate limit (Redis, shared across all workers) ----
  const slot = await reserveSendSlot({
    senderId: email.senderId,
    campaignId: email.campaignId,
    campaignLimit: email.campaign.hourlyLimit,
  });

  if (!slot.allowed) {
    const scopeKey = slot.scope === 'sender' ? `sender:${email.senderId}` : `campaign:${email.campaignId}`;
    const spacing = Math.max(env.MIN_DELAY_BETWEEN_SENDS_MS, email.campaign.delayMs, 1000);
    const runAt = await nextWindowSlot(scopeKey, slot.window, spacing);

    await prisma.email.update({ where: { id: emailId }, data: { scheduledAt: new Date(runAt) } });
    await updateEmailDoc(emailId, { scheduledAt: new Date(runAt).toISOString() });

    if (await markLimitNotified(scopeKey, slot.window)) {
      logger.warn('worker', `${slot.scope} hourly limit (${slot.limit}) hit – rescheduling into next window`);
      void notifyRateLimit(email.userId, {
        scope: slot.scope,
        senderEmail: email.sender.email,
        subject: email.subject,
        limit: slot.limit,
        resumeAt: new Date(runAt),
      });
    }

    // Move this same job back to the delayed set (not a new job, not a failure, attempts untouched).
    await job.moveToDelayed(runAt, token);
    throw new DelayedError();
  }

  // ---- Minimum delay between sends of this sender (Redis slot reservation) ----
  const sendAt = await reserveSenderGapSlot(email.senderId, env.MIN_DELAY_BETWEEN_SENDS_MS);
  const wait = sendAt - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  // ---- Claim the row (atomic) ----
  const claimed = await prisma.email.updateMany({
    where: { id: emailId, status: 'SCHEDULED' },
    data: { status: 'SENDING', attempts: { increment: 1 } },
  });
  if (claimed.count === 0) {
    await releaseSendSlot({ senderId: email.senderId, campaignId: email.campaignId });
    return { status: 'skipped', reason: 'claimed by another worker' };
  }

  // ---- Send ----
  try {
    const transport = features.simulatedDelivery ? simulatedTransport : getTransport(email.sender);
    const info = await transport.sendMail({
      from: `"${email.sender.name}" <${email.sender.email}>`,
      to: email.toName ? `"${email.toName}" <${email.toEmail}>` : email.toEmail,
      subject: email.subject,
      html: email.body,
      text: htmlToText(email.body),
      headers: { 'X-Outbox-Email-Id': email.id },
    });
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    const sentAt = new Date();

    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'SENT', sentAt, messageId: info.messageId, previewUrl, failedReason: null },
    });
    await updateEmailDoc(emailId, { status: 'sent', sentAt: sentAt.toISOString() });
    logger.info(
      'worker',
      `${features.simulatedDelivery ? 'simulated send' : 'sent'} ${email.toEmail} via ${email.sender.email}`,
      previewUrl ?? '',
    );
    return { status: 'sent', previewUrl };
  } catch (err) {
    const message = (err as Error).message;
    const isFinal = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    await prisma.email.update({
      where: { id: emailId },
      data: { status: isFinal ? 'FAILED' : 'SCHEDULED', failedReason: message },
    });
    if (isFinal) await updateEmailDoc(emailId, { status: 'failed' });
    logger.error('worker', `send failed for ${email.toEmail} (final=${isFinal})`, message);
    throw err; // let BullMQ apply retry/backoff
  }
}
