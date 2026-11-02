import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { env } from './config/env';
import { emailQueue } from './queue/emailQueue';
import { authRouter } from './routes/auth.routes';
import { campaignsRouter } from './routes/campaigns.routes';
import { emailsRouter } from './routes/emails.routes';
import { sendersRouter } from './routes/senders.routes';
import { slackRouter } from './routes/slack.routes';
import { errorHandler } from './middleware/error';
import { isSearchReady } from './services/search.service';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  // Live BullMQ dashboard
  const boardAdapter = new ExpressAdapter();
  boardAdapter.setBasePath('/admin/queues');
  createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: boardAdapter });
  app.use('/admin/queues', boardAdapter.getRouter());

  app.get('/api/health', (_req, res) => res.json({ ok: true, search: isSearchReady() }));
  app.use('/api/auth', authRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/senders', sendersRouter);
  app.use('/api/slack', slackRouter);

  app.use(errorHandler);
  return app;
}
