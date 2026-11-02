# Outbox – Full-stack Email Job Scheduler

A production-style email scheduler with a dashboard. You schedule emails through an API (or the React UI). They're stored in **PostgreSQL**, run as **BullMQ delayed jobs** on **Redis** (no cron), sent through **Ethereal SMTP**, indexed in **Elasticsearch** for search, and throttled by **Redis-backed rate limits** that send **Slack alerts** when a limit is hit.

```
outbox/
├── docker-compose.yml        # Postgres 16, Redis 7 (AOF), Elasticsearch 8
├── backend/                  # Express + TypeScript + Prisma + BullMQ
│   ├── prisma/schema.prisma
│   ├── scripts/loadTest.ts   # 1000+ email / rate-limit demo
│   └── src/
│       ├── config/env.ts     # validated env config (zod)
│       ├── lib/              # prisma, redis, logger
│       ├── middleware/       # auth (JWT cookie), error handling
│       ├── queue/            # queue, worker, job processor, rate limiter
│       ├── routes/           # auth, campaigns, emails, senders, slack
│       ├── services/         # campaign, search (ES), slack, senders, reconcile
│       ├── server.ts         # API (+ embedded worker by default)
│       └── worker.ts         # standalone worker process (horizontal scaling)
├── frontend/                 # React + TypeScript + Vite + Tailwind v4 + TanStack Query
│   └── src/
│       ├── api/              # typed fetch client, response types, query hooks
│       ├── components/ui/    # Button, Input, IconButton, Avatar, Modal, Popover, Spinner, EmptyState, StatusBadge
│       ├── components/…      # layout (sidebar, user menu), emails (list, row, toolbar), compose (editor, recipients, send-later)
│       ├── context/          # AuthContext
│       ├── pages/            # Login, Mailbox (Scheduled/Sent), EmailDetail, Compose
│       └── utils/            # formatting, CSV/TXT lead parsing
└── docs/                     # Figma screenshots, sample-leads.csv
```

---

## 1. Running locally

**Prerequisites:** Node 20+ and Docker Desktop.

```bash
# 1. Infrastructure: Postgres, Redis (persistent AOF), Elasticsearch
docker compose up -d

# 2. Backend (API + BullMQ worker)
cd backend
cp .env.example .env            # then set JWT_SECRET (and later Google/Slack keys)
npm install
npx prisma migrate deploy       # create tables
npm run dev                     # http://localhost:4000  (Ctrl+C = graceful shutdown)
# npm run dev:watch             # auto-reload while coding; on Windows its Ctrl+C is a hard kill

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

Open **http://localhost:5173**. On the login page you can:
- Log in with Google (once the OAuth keys are set), or
- Use email + password. An unknown email signs you up automatically ("or sign up through email").

| URL | What |
|---|---|
| http://localhost:5173 | Dashboard |
| http://localhost:4000/admin/queues (also proxied at :5173/admin/queues) | **Live BullMQ dashboard** (Bull Board) |
| http://localhost:4000/api/health | Health check (includes Elasticsearch status) |

**Scaling workers:** start the API with `RUN_WORKER=false` (`npm run dev:api`), then run as many `npm run dev:worker` processes as you like. All coordination (deduplication, the gap between sends, hourly limits) goes through Redis and Postgres.

### Ethereal Email setup
Nothing to do. On first boot, the backend creates `ETHEREAL_SENDER_COUNT` (default 3) Ethereal test mailboxes through the Ethereal API and saves them as **senders** in Postgres. You pick one in the compose screen ("From").
- Each sent email stores its Ethereal **preview URL**. Open an email in the Sent tab and click *"View delivered message on Ethereal"*.
- To use your own Ethereal accounts instead, set `ETHEREAL_ACCOUNTS=user1@ethereal.email:pass1,user2@ethereal.email:pass2`.

### Google OAuth setup
1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** → *Web application*.
2. Authorized JavaScript origin: `http://localhost:5173`
3. Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
4. Put the values in `backend/.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart the backend.

### Slack OAuth setup
Slack requires an **HTTPS** redirect URL, so expose the backend through a tunnel, for example `cloudflared tunnel --url http://localhost:4000` or `ngrok http 4000`.
1. https://api.slack.com/apps → *Create New App* → From scratch.
2. **OAuth & Permissions**:
   - Add the redirect URL `https://<your-tunnel>/api/slack/callback`.
   - Add the bot scopes `incoming-webhook` and `chat:write`.
3. **Basic Information**: copy the Client ID and Client Secret.
4. In `backend/.env`, set:
   ```
   SLACK_CLIENT_ID=...
   SLACK_CLIENT_SECRET=...
   SLACK_REDIRECT_URI=https://<your-tunnel>/api/slack/callback
   ```
5. Restart the backend.
6. In the dashboard, open the user menu (top-left card) → **Connect Slack**. Approve access and pick a channel. A confirmation message is posted right away. *Send test message* and *Disconnect Slack* are in the same menu.

### Environment variables (backend)
| Variable | Default | Meaning |
|---|---|---|
| `WORKER_CONCURRENCY` | `5` | Jobs processed in parallel per worker process |
| `MIN_DELAY_BETWEEN_SENDS_MS` | `2000` | **Minimum 2 seconds between two sends from the same sender** (enforced across all workers) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `200` | Hourly cap per sender mailbox |
| `EMAIL_MAX_ATTEMPTS` | `3` | SMTP retries (exponential backoff, starting at 5s) before an email is marked `failed` |
| `ETHEREAL_SENDER_COUNT` / `ETHEREAL_ACCOUNTS` | `3` / – | Sender mailboxes |
| `GOOGLE_CLIENT_ID/SECRET` | – | Google login |
| `SLACK_CLIENT_ID/SECRET/REDIRECT_URI` | – | Slack OAuth |
| `DATABASE_URL`, `REDIS_URL`, `ELASTICSEARCH_URL` | docker defaults | Infrastructure |

---

### Deploying (Railway)

The root `Dockerfile` builds the React app and the API into one image. Express serves the UI, `/api` and `/admin/queues` from a single domain, so cookies and OAuth redirects need no CORS setup. On start the container runs `prisma migrate deploy`, then starts the API and worker.

1. Create a Railway project from this GitHub repo. `railway.json` selects the Dockerfile and sets a `/api/health` healthcheck.
2. Add the **PostgreSQL** and **Redis** services. Elasticsearch is optional: add it from a template, or leave it out and search falls back to Postgres `ILIKE`.
3. Set these variables on the app service: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `REDIS_URL=${{Redis.REDIS_URL}}`, `ELASTICSEARCH_URL` (if used), `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL` and `BACKEND_URL` (both set to the public Railway URL), plus the Google and Slack keys.
4. Add `<public-url>/api/auth/google/callback` to the Google OAuth client and `<public-url>/api/slack/callback` to the Slack app's redirect URLs, and set `SLACK_REDIRECT_URI` to that callback.

**Email delivery on Railway:** Railway's non-Pro plans block outbound SMTP, so Ethereal can't be reached from there. With `EMAIL_DELIVERY=auto` (the default), the app detects Railway (`RAILWAY_PROJECT_ID`) and **simulates** the final SMTP step. Each email still goes through the queue, the hourly limits, the per-sender delay and the idempotent claim, and is then marked Sent with a generated Message-ID but not delivered. The UI shows a banner explaining this. Run locally to send for real through Ethereal; this is what the demo video shows. Set `EMAIL_DELIVERY=smtp` to force real sending on a host that allows SMTP.

## 2. Architecture

```
React ──► Express API ──► Postgres (source of truth: campaigns, emails, senders, users, slack)
                │
                ├──► BullMQ queue "email-send" in Redis (one delayed job per email, jobId = email id)
                │            │
                │            ▼
                │      Worker(s) ── Redis Lua: hourly counters + per-sender send gap
                │            │──► Ethereal SMTP (pooled transport per sender)
                │            │──► Postgres status update ──► Elasticsearch doc update
                │            └──► Slack webhook (when an hourly limit is first hit)
                └──► Elasticsearch (full-text search, Postgres fallback)
```

### How scheduling works
1. `POST /api/campaigns` takes `{ senderId, subject, body, recipients[], startAt, delaySeconds, hourlyLimit }`.
2. Recipients are deduplicated. Recipient *i* gets `scheduledAt = startAt + i × delaySeconds`.
3. In one transaction, a `Campaign` row and one `Email` row per recipient are inserted with status `SCHEDULED`.
4. One **BullMQ delayed job** per email is added with `delay = scheduledAt − now` and **`jobId = email.id`**, using `addBulk` in chunks of 500. 1,000 emails are scheduled in about 0.5 seconds.
5. Documents are bulk-indexed into Elasticsearch.
6. **No cron anywhere.** Redis holds each job's timestamp and BullMQ promotes the job when it's due.

An optional `Idempotency-Key` header makes the endpoint safe to retry. The frontend sends one key per compose session, so a double-click can't create two campaigns.

### How persistence on restart works
- **Redis persistence:** Redis runs with **AOF (`appendonly yes`, fsync every second)** and `maxmemory-policy noeviction`, so delayed jobs survive a Redis or server restart.
  - Tested: scheduled 997 jobs, force-killed the API, restarted the Redis container, then started the API again. All 997 were still delayed and the future emails went out on time.
- **Reconciliation on boot:** Postgres is the source of truth. Every `SCHEDULED` row is re-added to the queue with the same `jobId`.
  - BullMQ ignores duplicate job IDs, so this never creates duplicates.
  - It only repairs the case where Redis data was lost. Overdue emails are sent immediately, still subject to the rate limits.
- **Graceful shutdown:** on SIGINT/SIGTERM (Ctrl+C) the server stops accepting HTTP requests and stops picking up new jobs. `worker.close()` lets in-flight sends finish, and then connections close.
  - `npm run dev` runs plain `node --import tsx`, so Ctrl+C reaches the server directly.
  - `tsx watch` is only used for `dev:watch`. On Windows it force-kills its child process on Ctrl+C, which would cut a send off midway.
  - After a hard kill (power loss, `kill -9`), an email that was mid-send is marked `failed` instead of being resent (see Idempotency below).
- **Elasticsearch backfill:** on boot, if the index has fewer documents than Postgres, it's re-indexed from the database.

### Idempotency (no email is sent twice)
- **One job per email:** `jobId = email.id`, so the same email can never be queued twice.
- **Atomic claim:** before sending, the worker runs `UPDATE email SET status='SENDING' WHERE id=? AND status='SCHEDULED'`. Only one worker can win that update. Duplicate deliveries of a job, re-adds after a restart, and jobs whose email is already `SENT`/`FAILED` are skipped.
- **Crash during a send:** if a worker crashes after claiming an email but before recording the result, the stalled job is retried and finds the row still in `SENDING`. It then marks the email `failed` ("interrupted") instead of sending it again.
  - **This is a deliberate at-most-once choice.** For outreach, a duplicate email is worse than a missed one.
- **SMTP errors:** the row goes back to `SCHEDULED` and BullMQ retries with exponential backoff. After `EMAIL_MAX_ATTEMPTS`, the email is marked `failed` with the error message.

### Rate limiting and concurrency
| Concern | Implementation |
|---|---|
| **Concurrency** | `new Worker(..., { concurrency: WORKER_CONCURRENCY })`, plus any number of worker processes. Shared state lives in Redis or behind conditional SQL updates, never in memory. |
| **Delay between emails (per campaign)** | Built into the schedule: `startAt + i × delay` (the "Delay between 2 emails" field). |
| **Minimum delay between sends (per sender)** | A Redis Lua script atomically reserves the sender's next free slot, `max(now, lastSlot + MIN_DELAY_BETWEEN_SENDS_MS)`. The worker waits until that slot before sending. This holds across all workers and machines. **Default: at least 2 seconds between sends per sender.** |
| **Emails per hour** | Two Redis counters per hour window (`floor(now / 1h)`): `ratelimit:sender:{senderId}:{window}` (limit `MAX_EMAILS_PER_HOUR_PER_SENDER`) and `ratelimit:campaign:{campaignId}:{window}` (the "Hourly Limit" from the compose screen). One Lua script **checks both and increments both atomically**, so there are no races between workers. Keys expire automatically. |
| **When the limit is reached** | The job is **not dropped or failed**. A per-scope Redis sequence (`INCR`) gives it the next slot in the **next hour window**: `nextWindowStart + seq × spacing`. The job is moved back to the delayed set (`job.moveToDelayed` + `DelayedError`), keeping the same job and its attempt count. The row's `scheduledAt` is updated so the UI shows the new time. Jobs hit the limit in schedule order, so the sequence **keeps the original order**. |
| **Slack alert** | The first job to hit a limit in a given scope and hour sets `ratelimit:notified:{scope}:{window}` with `SET NX`. That job (and only that job) posts to the user's Slack webhook. The Slack connection is read from the database on every alert, so connecting or disconnecting takes effect immediately with no redeploy. With no Slack connection, nothing happens and nothing crashes. |

**Why not BullMQ's built-in `limiter`?** It's global to the queue, and it also throttles jobs that are only going to be rescheduled. With 1,000 jobs due at once, pushing the over-limit jobs to the next hour would take about 30 minutes, one every 2 seconds. A per-sender gap in Redis lets over-limit jobs be rescheduled instantly and throttles only real sends.

### Behaviour under load (1000+ emails at the same time)
Example: `npm run load-test -- --count 1000 --hourly 5`

1. The API inserts 1,000 rows and 1,000 delayed jobs in about 0.5 seconds.
2. When they come due, workers pick them up (5 at a time per process).
3. The first 5 get hourly slots and send, 2 seconds apart (the per-sender gap).
4. The other 995 immediately fail the hourly check. They're rescheduled to `16:00:00, 16:00:02, 16:00:04 …` in original order, and **one** Slack alert is sent.
5. In the next hour, 5 more send and the rest spill into the following hour again. Nothing is dropped.

*Trade-off:* spilled jobs are spaced by `max(MIN_DELAY, campaign delay)`. So a batch that's far over the limit gets re-checked once per hour, which costs one cheap Redis call per job per hour.

### Search
- Every email is indexed in Elasticsearch: recipient, sender, subject, plain-text body, status, and dates.
- Status changes (sent/failed) and reschedules update the document.
- The search box in both tabs runs a `multi_match` with fuzziness and a `phrase_prefix` query, scoped to the current user and folder. "meetng" finds "meeting".
- If Elasticsearch is down, the API falls back to Postgres `ILIKE`. The UI shows which engine answered.

---

## 3. Features implemented

### Backend
| Requirement | Where |
|---|---|
| Schedule via API, stored in Postgres | `routes/campaigns.routes.ts`, `services/campaign.service.ts`, `prisma/schema.prisma` |
| BullMQ delayed jobs, no cron | `queue/emailQueue.ts` |
| Multiple Ethereal senders | `services/sender.service.ts` |
| Persistence and restart safety | Redis AOF (`docker-compose.yml`), `services/reconcile.service.ts`, graceful shutdown in `server.ts` |
| Idempotency | `jobId = email.id`, atomic claim in `queue/processor.ts`, `Idempotency-Key` header |
| Configurable worker concurrency | `queue/worker.ts` (`WORKER_CONCURRENCY`) |
| Minimum delay between sends | `queue/rateLimiter.ts` → `reserveSenderGapSlot` |
| Hourly limits (per sender + per campaign), Redis-backed, reschedule to the next window | `queue/rateLimiter.ts`, `queue/processor.ts` |
| Slack OAuth plus a live alert on a limit hit | `routes/slack.routes.ts`, `services/slack.service.ts` |
| Elasticsearch search | `services/search.service.ts`, `GET /api/emails?q=` |
| Live BullMQ dashboard | Bull Board at `/admin/queues` (`app.ts`) |
| Standalone, horizontally scalable worker | `src/worker.ts` |

### Frontend
| Requirement | Where |
|---|---|
| Real Google OAuth login, plus email/password from the Figma | `pages/LoginPage.tsx`, `context/AuthContext.tsx` |
| Header with name, email, avatar and logout | `components/layout/UserMenu.tsx` (sidebar card, as in the Figma) |
| Scheduled / Sent tabs with counts, Compose button | `components/layout/Sidebar.tsx`, `pages/MailboxPage.tsx` |
| Compose: from, to (chips + **CSV/TXT upload with detected count**), subject, delay, hourly limit, rich-text body, Send Later picker | `pages/ComposePage.tsx`, `components/compose/*`, `utils/parseLeads.ts` |
| Tables with email, subject, time and status; loading skeletons, empty states, pagination, filter, refresh, search | `components/emails/*` |
| Email detail view | `pages/EmailDetailPage.tsx` |
| Toasts for errors and success | `react-hot-toast` |
| Typed API layer | `api/types.ts`, `api/client.ts`, `api/hooks.ts` |

### API summary
| Method | Path | |
|---|---|---|
| GET | `/api/auth/google` → `/api/auth/google/callback` | Google OAuth |
| POST | `/api/auth/login` | Email/password log in or sign up |
| GET / POST | `/api/auth/me`, `/api/auth/logout` | Session |
| GET | `/api/senders` | Sender mailboxes |
| POST | `/api/campaigns` | Schedule emails (`Idempotency-Key` header optional) |
| GET | `/api/emails?folder=scheduled\|sent&status=&q=&page=` | List or search |
| GET | `/api/emails/stats`, `/api/emails/:id` | Counts, detail |
| GET / DELETE / POST | `/api/slack/status`, `/api/slack/connect`, `/api/slack/callback`, `/api/slack`, `/api/slack/test` | Slack |

---

## 4. Assumptions, shortcuts and trade-offs
- **At-most-once delivery:** an email interrupted mid-send is marked failed rather than risking a duplicate.
- **Hour windows are clock hours (UTC)**, not a sliding 60-minute window. That's simpler and cheap in Redis. The trade-off is that up to 2× the limit can go out across a window boundary.
- **A failed SMTP attempt still counts** toward the hourly limit, since the provider usually counts attempts too.
- **Senders are shared** by all users (they're demo Ethereal mailboxes). Emails, campaigns, search and Slack are scoped per user.
- **Email/password login** exists because it's in the Figma and makes local testing easy without OAuth keys. Unknown emails are signed up automatically.
- **Bull Board is unauthenticated** in this local setup. In production it would sit behind admin auth.
- The Figma's star/archive/delete icons are shown but not wired up (out of scope).
- The rich-text body is stored as HTML, sanitized with DOMPurify when displayed, and sent as both HTML and plain text.
