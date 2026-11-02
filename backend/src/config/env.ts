import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  BACKEND_URL: z.string().default('http://localhost:4000'),
  JWT_SECRET: z.string().min(8).default('dev-secret-change-me'),
  RUN_WORKER: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  ELASTICSEARCH_INDEX: z.string().default('emails'),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MIN_DELAY_BETWEEN_SENDS_MS: z.coerce.number().int().nonnegative().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().int().positive().default(200),
  EMAIL_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),

  ETHEREAL_SENDER_COUNT: z.coerce.number().int().positive().default(3),
  ETHEREAL_ACCOUNTS: z.string().optional().default(''),
  // auto = simulate on Railway (its non-Pro plans block outbound SMTP), real SMTP everywhere else.
  EMAIL_DELIVERY: z.enum(['auto', 'smtp', 'simulate']).default('auto'),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),

  SLACK_CLIENT_ID: z.string().optional().default(''),
  SLACK_CLIENT_SECRET: z.string().optional().default(''),
  SLACK_REDIRECT_URI: z.string().optional().default(''),
});

export const env = schema.parse(process.env);

export const features = {
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  slack: Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET),
  simulatedDelivery:
    env.EMAIL_DELIVERY === 'simulate' || (env.EMAIL_DELIVERY === 'auto' && Boolean(process.env.RAILWAY_PROJECT_ID)),
};
