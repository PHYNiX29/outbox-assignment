/**
 * Load / rate-limit demo: schedules N emails for (almost) the same moment through the public API.
 *
 *   npm run load-test -- --count 1000 --hourly 10 --delay 0
 *
 * With --hourly 10, only 10 go out this hour; the rest are rescheduled into following hour windows
 * (visible in the dashboard + Bull Board), and a Slack alert fires if Slack is connected.
 */
const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] ?? '']);
    return acc;
  }, []),
);

const API = args.api ?? 'http://localhost:4000/api';
const COUNT = Number(args.count ?? 1000);
const HOURLY = args.hourly ? Number(args.hourly) : null;
const DELAY = Number(args.delay ?? 0);
const EMAIL = args.email ?? 'demo.user@example.com';
const PASSWORD = args.password ?? 'secret123';

async function main() {
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!login.ok) throw new Error(`login failed: ${await login.text()}`);
  const cookie = login.headers.get('set-cookie')!.split(';')[0];

  const { senders } = (await (await fetch(`${API}/senders`, { headers: { cookie } })).json()) as {
    senders: { id: string; email: string }[];
  };
  const sender = senders[Number(args.sender ?? 0)];

  const recipients = Array.from({ length: COUNT }, (_, i) => ({
    email: `lead${String(i + 1).padStart(4, '0')}@example.com`,
    name: `Lead ${i + 1}`,
  }));

  const started = Date.now();
  const res = await fetch(`${API}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      senderId: sender.id,
      subject: `Load test (${COUNT} emails)`,
      body: '<p>Hi there,</p><p>This is a load-test email from the Outbox scheduler.</p>',
      recipients,
      startAt: new Date(Date.now() + 5000).toISOString(),
      delaySeconds: DELAY,
      hourlyLimit: HOURLY,
    }),
  });
  console.log(res.status, await res.json(), `in ${Date.now() - started}ms`);
  console.log(`sender: ${sender.email}, hourly limit: ${HOURLY ?? 'server default'}, delay: ${DELAY}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
