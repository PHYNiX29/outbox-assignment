import { Router } from 'express';
import type { EmailStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { searchEmailIds } from '../services/search.service';
import { htmlToText } from '../utils/text';

export const emailsRouter = Router();
emailsRouter.use(requireAuth);

/** "scheduled" tab = waiting or in-flight, "sent" tab = finished (sent or failed). */
const FOLDERS: Record<'scheduled' | 'sent', EmailStatus[]> = {
  scheduled: ['SCHEDULED', 'SENDING'],
  sent: ['SENT', 'FAILED'],
};

const emailInclude = { sender: { select: { name: true, email: true } } } satisfies Prisma.EmailInclude;
type EmailWithSender = Prisma.EmailGetPayload<{ include: typeof emailInclude }>;

const toListItem = (e: EmailWithSender) => ({
  id: e.id,
  toEmail: e.toEmail,
  toName: e.toName,
  from: e.sender,
  subject: e.subject,
  preview: htmlToText(e.body).slice(0, 160),
  status: e.status.toLowerCase(),
  scheduledAt: e.scheduledAt,
  sentAt: e.sentAt,
  failedReason: e.failedReason,
});

const listQuery = z.object({
  folder: z.enum(['scheduled', 'sent']),
  status: z.enum(['scheduled', 'sending', 'sent', 'failed']).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

emailsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { folder, status, q, page, limit } = listQuery.parse(req.query);
    const statuses = status ? [status.toUpperCase() as EmailStatus] : FOLDERS[folder];
    const orderBy: Prisma.EmailOrderByWithRelationInput[] =
      folder === 'scheduled' ? [{ scheduledAt: 'asc' }, { seq: 'asc' }] : [{ sentAt: 'desc' }, { updatedAt: 'desc' }];

    // Full-text search via Elasticsearch; Postgres ILIKE fallback if ES is unavailable.
    if (q) {
      const ids = await searchEmailIds({
        userId: req.userId!,
        q,
        statuses: statuses.map((s) => s.toLowerCase()),
        limit: 100,
      });
      if (ids) {
        const rows = await prisma.email.findMany({ where: { id: { in: ids } }, include: emailInclude });
        const byId = new Map(rows.map((r) => [r.id, r]));
        const items = ids.map((id) => byId.get(id)).filter((e): e is EmailWithSender => Boolean(e));
        return res.json({ items: items.map(toListItem), total: items.length, page: 1, limit: 100, engine: 'elasticsearch' });
      }
    }

    const where: Prisma.EmailWhereInput = {
      userId: req.userId,
      status: { in: statuses },
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: 'insensitive' } },
              { toEmail: { contains: q, mode: 'insensitive' } },
              { toName: { contains: q, mode: 'insensitive' } },
              { body: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.email.findMany({ where, include: emailInclude, orderBy, skip: (page - 1) * limit, take: limit }),
      prisma.email.count({ where }),
    ]);
    res.json({ items: items.map(toListItem), total, page, limit, engine: q ? 'postgres' : undefined });
  }),
);

emailsRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const groups = await prisma.email.groupBy({
      by: ['status'],
      where: { userId: req.userId },
      _count: { _all: true },
    });
    const count = (s: EmailStatus[]) =>
      groups.filter((g) => s.includes(g.status)).reduce((n, g) => n + g._count._all, 0);
    res.json({
      scheduled: count(FOLDERS.scheduled),
      sent: count(FOLDERS.sent),
      failed: count(['FAILED']),
    });
  }),
);

emailsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const email = await prisma.email.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: emailInclude,
    });
    if (!email) throw new HttpError(404, 'Email not found');
    res.json({
      ...toListItem(email),
      body: email.body,
      previewUrl: email.previewUrl,
      messageId: email.messageId,
      attempts: email.attempts,
      createdAt: email.createdAt,
    });
  }),
);
