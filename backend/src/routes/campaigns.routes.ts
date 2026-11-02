import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { scheduleCampaign } from '../services/campaign.service';

export const campaignsRouter = Router();
campaignsRouter.use(requireAuth);

const scheduleSchema = z.object({
  senderId: z.string().min(1, 'Choose a sender'),
  subject: z.string().trim().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  recipients: z
    .array(z.object({ email: z.string().trim().email(), name: z.string().nullish() }))
    .min(1, 'Add at least one recipient')
    .max(10_000, 'Max 10,000 recipients per request'),
  // ISO string; if omitted the campaign starts immediately
  startAt: z.coerce.date().optional(),
  delaySeconds: z.coerce.number().int().min(0).max(86_400).default(0),
  hourlyLimit: z.coerce.number().int().min(1).max(100_000).nullish(),
});

/**
 * POST /api/campaigns – schedule one email per recipient.
 * Send an `Idempotency-Key` header to make retries of the same request safe.
 */
campaignsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = scheduleSchema.parse(req.body);
    const key = req.header('Idempotency-Key') || undefined;
    const result = await scheduleCampaign({
      userId: req.userId!,
      senderId: input.senderId,
      subject: input.subject,
      body: input.body,
      recipients: input.recipients,
      startAt: input.startAt ?? new Date(),
      delaySeconds: input.delaySeconds,
      hourlyLimit: input.hourlyLimit ?? null,
      idempotencyKey: key,
    });
    res.status(result.duplicate ? 200 : 201).json({
      campaignId: result.campaign.id,
      scheduled: result.count,
      startAt: result.campaign.startAt,
      duplicate: result.duplicate,
    });
  }),
);
