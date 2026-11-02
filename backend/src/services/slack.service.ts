import jwt from 'jsonwebtoken';
import { env, features } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const SCOPES = ['incoming-webhook', 'chat:write'];

export function slackRedirectUri() {
  return env.SLACK_REDIRECT_URI || `${env.BACKEND_URL}/api/slack/callback`;
}

/** The OAuth `state` is a short-lived signed token carrying the user id (CSRF protection + user binding). */
export function buildSlackAuthorizeUrl(userId: string): string {
  const state = jwt.sign({ userId, purpose: 'slack' }, env.JWT_SECRET, { expiresIn: '10m' });
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: SCOPES.join(','),
    redirect_uri: slackRedirectUri(),
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

export function verifySlackState(state: string): string {
  const payload = jwt.verify(state, env.JWT_SECRET) as { userId: string; purpose: string };
  if (payload.purpose !== 'slack') throw new Error('invalid state');
  return payload.userId;
}

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: { id: string; name: string };
  incoming_webhook?: { url: string; channel: string };
}

export async function exchangeSlackCode(code: string, userId: string) {
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: slackRedirectUri(),
    }),
  });
  const data = (await res.json()) as SlackOAuthResponse;
  if (!data.ok || !data.incoming_webhook || !data.team) {
    throw new Error(`Slack OAuth failed: ${data.error ?? 'missing webhook'}`);
  }
  const fields = {
    teamId: data.team.id,
    teamName: data.team.name,
    channelName: data.incoming_webhook.channel,
    webhookUrl: data.incoming_webhook.url,
    accessToken: data.access_token ?? null,
  };
  return prisma.slackConnection.upsert({
    where: { userId },
    update: fields,
    create: { userId, ...fields },
  });
}

export async function postToWebhook(webhookUrl: string, payload: object) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Slack webhook responded ${res.status}: ${await res.text()}`);
}

/**
 * Notify the user's Slack about a rate-limit hit. Looked up from the DB on every call,
 * so connecting / disconnecting Slack takes effect immediately without a redeploy.
 * Never throws – a Slack failure must not affect email processing.
 */
export async function notifyRateLimit(userId: string, info: {
  scope: 'sender' | 'campaign';
  senderEmail: string;
  subject: string;
  limit: number;
  resumeAt: Date;
}): Promise<void> {
  if (!features.slack) return;
  try {
    const conn = await prisma.slackConnection.findUnique({ where: { userId } });
    if (!conn) return; // user has not connected Slack – silently skip

    const what =
      info.scope === 'sender'
        ? `Sender *${info.senderEmail}* reached its hourly limit of *${info.limit}* emails.`
        : `Campaign *"${info.subject}"* reached its hourly limit of *${info.limit}* emails.`;

    await postToWebhook(conn.webhookUrl, {
      text: `⚠️ Hourly email limit reached: ${what}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '⚠️ Hourly email limit reached' } },
        { type: 'section', text: { type: 'mrkdwn', text: what } },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Remaining emails were rescheduled into the next hour window (starting ${info.resumeAt.toUTCString()}). Nothing was dropped.`,
            },
          ],
        },
      ],
    });
    logger.info('slack', `rate-limit notification sent for user ${userId}`);
  } catch (err) {
    logger.warn('slack', 'failed to send rate-limit notification', (err as Error).message);
  }
}
