import { Client } from '@elastic/elasticsearch';
import type { Email, Sender } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { htmlToText } from '../utils/text';
import { prisma } from '../lib/prisma';

/** A missing or malformed ELASTICSEARCH_URL disables ES (search falls back to Postgres) instead of crashing. */
function createClient(): Client | null {
  if (!env.ELASTICSEARCH_URL) return null;
  try {
    return new Client({ node: env.ELASTICSEARCH_URL });
  } catch (err) {
    logger.warn('search', `invalid ELASTICSEARCH_URL "${env.ELASTICSEARCH_URL}"`, (err as Error).message);
    return null;
  }
}
const client = createClient();
// Only used after `ready` is true, which requires a client.
const es = client as Client;
const INDEX = env.ELASTICSEARCH_INDEX;

let ready = false;
export const isSearchReady = () => ready;

export interface EmailDoc {
  id: string;
  userId: string;
  campaignId: string;
  toEmail: string;
  toName: string | null;
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyText: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
}

export const toDoc = (e: Email & { sender: Pick<Sender, 'email' | 'name'> }): EmailDoc => ({
  id: e.id,
  userId: e.userId,
  campaignId: e.campaignId,
  toEmail: e.toEmail,
  toName: e.toName,
  fromEmail: e.sender.email,
  fromName: e.sender.name,
  subject: e.subject,
  bodyText: htmlToText(e.body),
  status: e.status.toLowerCase(),
  scheduledAt: e.scheduledAt.toISOString(),
  sentAt: e.sentAt ? e.sentAt.toISOString() : null,
});

/** Create the index (idempotent). Retries in the background because ES boots slowly. */
export async function initSearch(retries = 30): Promise<void> {
  if (!client) {
    logger.warn('search', 'Elasticsearch disabled – search uses Postgres');
    return;
  }
  for (let i = 0; i < retries; i++) {
    try {
      const exists = await es.indices.exists({ index: INDEX });
      if (!exists) {
        await es.indices.create({
          index: INDEX,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              campaignId: { type: 'keyword' },
              status: { type: 'keyword' },
              toEmail: {
                type: 'text',
                analyzer: 'standard',
                fields: { raw: { type: 'keyword' } },
              },
              toName: { type: 'text' },
              fromEmail: { type: 'text', fields: { raw: { type: 'keyword' } } },
              fromName: { type: 'text' },
              subject: { type: 'text' },
              bodyText: { type: 'text' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
            },
          },
        });
        logger.info('search', `created index "${INDEX}"`);
      }
      ready = true;
      logger.info('search', 'Elasticsearch ready');
      await backfillFromDb();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  logger.warn('search', 'Elasticsearch unavailable – search falls back to Postgres');
}

/**
 * Postgres is the source of truth. If the index is missing documents (e.g. emails were created
 * while ES was down, or the ES volume was wiped), re-index everything from the DB.
 */
async function backfillFromDb(): Promise<void> {
  try {
    await es.indices.refresh({ index: INDEX });
    const [{ count: indexed }, total] = await Promise.all([es.count({ index: INDEX }), prisma.email.count()]);
    if (indexed >= total) return;

    logger.info('search', `backfilling index (${indexed}/${total} indexed)…`);
    const PAGE = 1000;
    let cursor: string | undefined;
    for (;;) {
      const rows = await prisma.email.findMany({
        include: { sender: { select: { email: true, name: true } } },
        orderBy: { id: 'asc' },
        take: PAGE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (!rows.length) break;
      await indexEmails(rows.map(toDoc));
      cursor = rows[rows.length - 1].id;
    }
    logger.info('search', 'backfill complete');
  } catch (err) {
    logger.warn('search', 'backfill failed', (err as Error).message);
  }
}

/** Indexing is best-effort: a search outage must never break scheduling or sending. */
export async function indexEmails(docs: EmailDoc[]): Promise<void> {
  if (!ready || docs.length === 0) return;
  try {
    const operations = docs.flatMap((d) => [{ index: { _index: INDEX, _id: d.id } }, d]);
    const res = await es.bulk({ operations, refresh: false });
    if (res.errors) logger.warn('search', 'some documents failed to index');
  } catch (err) {
    logger.warn('search', 'bulk index failed', (err as Error).message);
  }
}

export async function updateEmailDoc(id: string, patch: Partial<EmailDoc>): Promise<void> {
  if (!ready) return;
  try {
    await es.update({ index: INDEX, id, doc: patch, doc_as_upsert: false, retry_on_conflict: 3 });
  } catch (err) {
    logger.warn('search', `update failed for ${id}`, (err as Error).message);
  }
}

export interface SearchParams {
  userId: string;
  q: string;
  statuses?: string[];
  limit?: number;
}

/** Returns matching email ids ordered by relevance, or null if ES is unavailable. */
export async function searchEmailIds(p: SearchParams): Promise<string[] | null> {
  if (!ready) return null;
  try {
    const res = await es.search<EmailDoc>({
      index: INDEX,
      size: p.limit ?? 100,
      query: {
        bool: {
          filter: [
            { term: { userId: p.userId } },
            ...(p.statuses?.length ? [{ terms: { status: p.statuses } }] : []),
          ],
          should: [
            {
              multi_match: {
                query: p.q,
                fields: ['subject^3', 'toEmail^2', 'toName^2', 'fromEmail', 'fromName', 'bodyText'],
                fuzziness: 'AUTO',
              },
            },
            {
              multi_match: {
                query: p.q,
                type: 'phrase_prefix',
                fields: ['subject^3', 'toEmail^2', 'toName^2', 'bodyText'],
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
    });
    return res.hits.hits.map((h) => h._id as string);
  } catch (err) {
    logger.warn('search', 'query failed', (err as Error).message);
    return null;
  }
}
