import nodemailer, { type Transporter } from 'nodemailer';
import type { Sender } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const SENDER_NAMES = ['Amanda Clark', 'Grant Miller', 'Priya Sharma', 'Lucas Brown', 'Mia Chen'];

/**
 * Make sure we have Ethereal sender mailboxes in the DB.
 * - If ETHEREAL_ACCOUNTS is set ("user:pass,user:pass") those are upserted.
 * - Otherwise, if the DB has none, ETHEREAL_SENDER_COUNT test accounts are created via the Ethereal API.
 */
export async function ensureSenders(): Promise<void> {
  const configured = env.ETHEREAL_ACCOUNTS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (configured.length) {
    for (const [i, pair] of configured.entries()) {
      const idx = pair.indexOf(':');
      const user = pair.slice(0, idx);
      const pass = pair.slice(idx + 1);
      await prisma.sender.upsert({
        where: { email: user },
        update: { smtpUser: user, smtpPass: pass },
        create: {
          name: SENDER_NAMES[i % SENDER_NAMES.length],
          email: user,
          smtpHost: 'smtp.ethereal.email',
          smtpPort: 587,
          smtpUser: user,
          smtpPass: pass,
        },
      });
    }
    return;
  }

  const count = await prisma.sender.count();
  if (count >= env.ETHEREAL_SENDER_COUNT) return;

  logger.info('senders', `creating ${env.ETHEREAL_SENDER_COUNT - count} Ethereal test accounts…`);
  for (let i = count; i < env.ETHEREAL_SENDER_COUNT; i++) {
    const acc = await createEtherealAccount();
    await prisma.sender.upsert({
      where: { email: acc.user },
      update: {},
      create: {
        name: SENDER_NAMES[i % SENDER_NAMES.length],
        email: acc.user,
        smtpHost: acc.smtp.host,
        smtpPort: acc.smtp.port,
        smtpUser: acc.user,
        smtpPass: acc.pass,
      },
    });
    logger.info('senders', `created ${acc.user}`);
  }
}

/**
 * nodemailer.createTestAccount() caches the first account it creates, so calling it in a loop
 * returns the same mailbox. Call the Ethereal API directly to get distinct accounts.
 */
async function createEtherealAccount(): Promise<{
  user: string;
  pass: string;
  smtp: { host: string; port: number };
}> {
  const res = await fetch('https://api.nodemailer.com/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestor: 'outbox-scheduler', version: '1.0.0' }),
  });
  const data = (await res.json()) as {
    status: string;
    error?: string;
    user: string;
    pass: string;
    smtp: { host: string; port: number };
  };
  if (data.status !== 'success') throw new Error(`Ethereal account creation failed: ${data.error ?? res.status}`);
  return data;
}

// One pooled SMTP transport per sender, reused across jobs (safe for concurrent use).
const transports = new Map<string, Transporter>();

export function getTransport(sender: Sender): Transporter {
  let t = transports.get(sender.id);
  if (!t) {
    t = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: { user: sender.smtpUser, pass: sender.smtpPass },
      pool: true,
      maxConnections: 3,
      // Fail fast if the SMTP server can't be reached (nodemailer's default waits 2 minutes).
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
    });
    transports.set(sender.id, t);
  }
  return t;
}

export function closeTransports() {
  for (const t of transports.values()) t.close();
  transports.clear();
}
