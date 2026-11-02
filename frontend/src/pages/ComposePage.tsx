import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ChevronDown, Clock, Paperclip } from 'lucide-react';
import { useScheduleCampaign, useSenders } from '../api/hooks';
import type { Recipient } from '../api/types';
import { RecipientInput } from '../components/compose/RecipientInput';
import { RichTextEditor } from '../components/compose/RichTextEditor';
import { SendLaterPopover } from '../components/compose/SendLaterPopover';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Input } from '../components/ui/Input';
import { formatDateTime } from '../utils/format';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-[60px] shrink-0 text-lg">{label}</span>
      {children}
    </div>
  );
}

export function ComposePage() {
  const navigate = useNavigate();
  const senders = useSenders();
  const schedule = useScheduleCampaign();
  // One idempotency key per compose session: double-clicks / retries can't create duplicate campaigns.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [senderId, setSenderId] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [subject, setSubject] = useState('');
  const [delay, setDelay] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState('');
  const [body, setBody] = useState({ html: '', empty: true });
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [laterOpen, setLaterOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; count: number } | null>(null);

  useEffect(() => {
    if (!senderId && senders.data?.length) setSenderId(senders.data[0]!.id);
  }, [senders.data, senderId]);

  const validate = (): string | null => {
    if (!senderId) return 'Choose a sender';
    if (!recipients.length) return 'Add at least one recipient (type or upload a list)';
    if (!subject.trim()) return 'Subject is required';
    if (body.empty) return 'Email body is empty';
    if (delay && (!/^\d+$/.test(delay) || Number(delay) > 86400)) return 'Delay must be 0–86400 seconds';
    if (hourlyLimit && (!/^\d+$/.test(hourlyLimit) || Number(hourlyLimit) < 1)) return 'Hourly limit must be a positive number';
    if (startAt && startAt.getTime() < Date.now() - 60_000) return 'Start time is in the past';
    return null;
  };

  const submit = () => {
    const err = validate();
    if (err) return void toast.error(err);
    schedule.mutate(
      {
        idempotencyKey,
        payload: {
          senderId,
          subject: subject.trim(),
          body: body.html,
          recipients,
          startAt: (startAt ?? new Date()).toISOString(),
          delaySeconds: delay ? Number(delay) : 0,
          hourlyLimit: hourlyLimit ? Number(hourlyLimit) : null,
        },
      },
      {
        onSuccess: (r) => {
          toast.success(`${r.scheduled} email${r.scheduled === 1 ? '' : 's'} scheduled`);
          navigate('/scheduled');
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="min-h-full">
      <header className="flex items-center gap-4 px-5 py-5">
        <IconButton label="Back" onClick={() => navigate(-1)} className="text-ink">
          <ArrowLeft size={24} />
        </IconButton>
        <h1 className="flex-1 text-[28px]">Compose New Email</h1>

        <IconButton
          label={uploadedFile ? `${uploadedFile.name} (${uploadedFile.count} leads)` : 'Upload lead list'}
          active={Boolean(uploadedFile)}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={22} />
          {uploadedFile && (
            <span className="absolute bottom-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-surface px-1 text-[10px] text-ink">
              1
            </span>
          )}
        </IconButton>

        <div className="relative flex items-center gap-4">
          <IconButton label="Send later" active={Boolean(startAt)} onClick={() => setLaterOpen((o) => !o)}>
            <Clock size={22} />
          </IconButton>
          <Button variant="outline" rounded="full" size="lg" className="min-w-[124px]" loading={schedule.isPending} onClick={submit}>
            {startAt ? 'Send Later' : 'Send'}
          </Button>
          <SendLaterPopover open={laterOpen} value={startAt} onClose={() => setLaterOpen(false)} onDone={setStartAt} />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1305px] flex-col gap-5 px-[60px] pb-16 pt-3">
        <Row label="From">
          <div className="relative">
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              disabled={senders.isLoading}
              className="h-12 appearance-none rounded-lg bg-surface py-2 pl-3 pr-10 text-lg outline-none"
            >
              {senders.isLoading && <option>Loading senders…</option>}
              {senders.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.email}
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          </div>
        </Row>

        <Row label="To">
          <RecipientInput
            value={recipients}
            onChange={setRecipients}
            fileInputRef={fileInputRef}
            onFileLoaded={(name, count) => setUploadedFile({ name, count })}
          />
        </Row>

        <Row label="Subject">
          <div className="flex-1 border-b border-line">
            <Input variant="underline" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        </Row>

        <div className="flex flex-wrap items-center gap-8">
          <label className="flex items-center gap-4 text-lg">
            Delay between 2 emails
            <Input
              variant="boxed"
              inputMode="numeric"
              placeholder="00"
              value={delay}
              onChange={(e) => setDelay(e.target.value.replace(/\D/g, ''))}
              title="Seconds between consecutive emails"
            />
            <span className="-ml-2 text-sm text-muted">sec</span>
          </label>
          <label className="flex items-center gap-2 text-lg">
            Hourly Limit
            <Input
              variant="boxed"
              inputMode="numeric"
              placeholder="00"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value.replace(/\D/g, ''))}
              title="Max emails per hour for this campaign (blank = server default)"
            />
          </label>
          {startAt && (
            <span className="rounded-full bg-[#fff1e3] px-3 py-1 text-sm text-[#c2410c]">
              Starts {formatDateTime(startAt.toISOString())}
            </span>
          )}
        </div>

        <RichTextEditor onChange={(html, empty) => setBody({ html, empty })} />
      </div>
    </div>
  );
}
