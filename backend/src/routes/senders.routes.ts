import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

export const sendersRouter = Router();
sendersRouter.use(requireAuth);

sendersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const senders = await prisma.sender.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ senders });
  }),
);
