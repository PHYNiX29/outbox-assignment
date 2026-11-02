import IORedis from 'ioredis';
import { env } from '../config/env';

/**
 * BullMQ requires `maxRetriesPerRequest: null` on connections used by workers.
 * We create one shared connection for app-level commands (rate-limit counters etc.)
 * and let BullMQ create its own from the same options.
 */
export const redisOptions = { maxRetriesPerRequest: null } as const;

export const createRedis = () => new IORedis(env.REDIS_URL, redisOptions);

export const redis = createRedis();
