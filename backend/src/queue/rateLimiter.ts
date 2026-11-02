import { env } from '../config/env';
import { redis } from '../lib/redis';

const HOUR_MS = 60 * 60 * 1000;

export const hourWindow = (ts = Date.now()) => Math.floor(ts / HOUR_MS);
export const windowStart = (w: number) => w * HOUR_MS;

/**
 * Atomically checks and reserves one send slot in the current hour window for:
 *   1. the sender mailbox  (limit = MAX_EMAILS_PER_HOUR_PER_SENDER from env)
 *   2. the campaign        (limit = "Hourly limit" entered in the compose screen, optional)
 *
 * Runs as a single Lua script in Redis, so it is race-free across any number of
 * worker processes / machines. Counters auto-expire shortly after the window ends.
 *
 * Returns 0 = allowed, 1 = sender limit hit, 2 = campaign limit hit.
 */
const RESERVE_LUA = `
local senderCount = tonumber(redis.call('GET', KEYS[1]) or '0')
local campaignCount = tonumber(redis.call('GET', KEYS[2]) or '0')
local senderLimit = tonumber(ARGV[1])
local campaignLimit = tonumber(ARGV[2])
if senderCount >= senderLimit then return 1 end
if campaignLimit > 0 and campaignCount >= campaignLimit then return 2 end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[3])
redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], ARGV[3])
return 0
`;

export type LimitResult =
  | { allowed: true }
  | { allowed: false; scope: 'sender' | 'campaign'; limit: number; window: number };

export async function reserveSendSlot(opts: {
  senderId: string;
  campaignId: string;
  campaignLimit: number | null;
}): Promise<LimitResult> {
  const w = hourWindow();
  const senderKey = `ratelimit:sender:${opts.senderId}:${w}`;
  const campaignKey = `ratelimit:campaign:${opts.campaignId}:${w}`;
  const ttl = 2 * 60 * 60; // 2h, comfortably past the window end

  const res = (await redis.eval(
    RESERVE_LUA,
    2,
    senderKey,
    campaignKey,
    env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    opts.campaignLimit ?? 0,
    ttl,
  )) as number;

  if (res === 0) return { allowed: true };
  return res === 1
    ? { allowed: false, scope: 'sender', limit: env.MAX_EMAILS_PER_HOUR_PER_SENDER, window: w }
    : { allowed: false, scope: 'campaign', limit: opts.campaignLimit ?? 0, window: w };
}

/** Give back a slot (used when a reserved send ends up not happening). */
export async function releaseSendSlot(opts: { senderId: string; campaignId: string }) {
  const w = hourWindow();
  await redis
    .multi()
    .decr(`ratelimit:sender:${opts.senderId}:${w}`)
    .decr(`ratelimit:campaign:${opts.campaignId}:${w}`)
    .exec();
}

/**
 * Pick the timestamp in the NEXT hour window for a job that was over the limit.
 * A per-scope Redis sequence (INCR) hands out increasing offsets, so jobs keep the order in
 * which they hit the limit (which is their original schedule order) and are spaced out
 * instead of all firing at minute 0 of the next hour.
 */
export async function nextWindowSlot(scopeKey: string, window: number, spacingMs: number): Promise<number> {
  const next = window + 1;
  const seqKey = `ratelimit:resched:${scopeKey}:${next}`;
  const seq = await redis.incr(seqKey);
  if (seq === 1) await redis.expire(seqKey, 3 * 60 * 60);
  return windowStart(next) + (seq - 1) * spacingMs;
}

/**
 * Minimum gap between two sends from the same sender, coordinated through Redis so it holds across
 * all workers/instances. Each caller atomically reserves the next free slot
 * (max(now, lastSlot + gap)) and returns it; the worker waits until that moment before sending.
 */
const GAP_LUA = `
local now = tonumber(ARGV[1])
local gap = tonumber(ARGV[2])
local last = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot = math.max(now, last + gap)
redis.call('SET', KEYS[1], slot, 'PX', (slot - now) + gap + 1000)
return slot
`;

export async function reserveSenderGapSlot(senderId: string, gapMs: number): Promise<number> {
  if (gapMs <= 0) return Date.now();
  return (await redis.eval(GAP_LUA, 1, `throttle:sender:${senderId}`, Date.now(), gapMs)) as number;
}

/** Returns true only for the first caller per scope+window – used to send one Slack alert per window. */
export async function markLimitNotified(scopeKey: string, window: number): Promise<boolean> {
  const ok = await redis.set(`ratelimit:notified:${scopeKey}:${window}`, '1', 'EX', 2 * 60 * 60, 'NX');
  return ok === 'OK';
}
