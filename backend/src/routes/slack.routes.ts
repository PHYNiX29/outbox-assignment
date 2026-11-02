import { Router } from 'express';
import { env, features } from '../config/env';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { logger } from '../lib/logger';
import { buildSlackAuthorizeUrl, exchangeSlackCode, postToWebhook, verifySlackState } from '../services/slack.service';

export const slackRouter = Router();

slackRouter.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const conn = await prisma.slackConnection.findUnique({ where: { userId: req.userId } });
    res.json({
      configured: features.slack,
      connected: Boolean(conn),
      teamName: conn?.teamName ?? null,
      channelName: conn?.channelName ?? null,
    });
  }),
);

/** Returns the Slack authorize URL; the frontend navigates the browser to it. */
slackRouter.get('/connect', requireAuth, (req, res) => {
  if (!features.slack) throw new HttpError(400, 'Slack is not configured on the server');
  res.json({ url: buildSlackAuthorizeUrl(req.userId!) });
});

/**
 * Slack redirects here after the user approves. The browser may arrive via an HTTPS tunnel domain
 * (no session cookie), so the user is identified by the signed `state` instead.
 */
slackRouter.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    try {
      if (error) throw new Error(error);
      if (!code || !state) throw new Error('missing code/state');
      const userId = verifySlackState(state);
      const conn = await exchangeSlackCode(code, userId);
      await postToWebhook(conn.webhookUrl, {
        text: `✅ Outbox connected. You'll get a message here whenever a sender hits its hourly email limit.`,
      }).catch((e) => logger.warn('slack', 'welcome message failed', e.message));
      res.redirect(`${env.FRONTEND_URL}/scheduled?slack=connected`);
    } catch (err) {
      logger.warn('slack', 'OAuth callback failed', (err as Error).message);
      res.redirect(`${env.FRONTEND_URL}/scheduled?slack=error`);
    }
  }),
);

slackRouter.delete(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.slackConnection.deleteMany({ where: { userId: req.userId } });
    res.json({ ok: true });
  }),
);

slackRouter.post(
  '/test',
  requireAuth,
  asyncHandler(async (req, res) => {
    const conn = await prisma.slackConnection.findUnique({ where: { userId: req.userId } });
    if (!conn) throw new HttpError(400, 'Slack is not connected');
    await postToWebhook(conn.webhookUrl, { text: '👋 Test notification from Outbox email scheduler.' });
    res.json({ ok: true });
  }),
);
