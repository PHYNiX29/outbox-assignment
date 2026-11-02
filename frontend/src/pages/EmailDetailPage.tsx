import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { Archive, ArrowLeft, ExternalLink, Star, Trash2 } from 'lucide-react';
import { useEmail } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { FullPageSpinner } from '../components/ui/Spinner';
import { IconButton } from '../components/ui/IconButton';
import { StatusBadge } from '../components/ui/StatusBadge';
import { displayRecipient, formatDateTime } from '../utils/format';

export function EmailDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: email, isLoading, error } = useEmail(id);
  const html = useMemo(() => (email ? DOMPurify.sanitize(email.body) : ''), [email]);

  const header = (
    <header className="flex items-center gap-4 px-5 py-5">
      <IconButton label="Back" onClick={() => navigate(-1)} className="text-ink">
        <ArrowLeft size={24} />
      </IconButton>
      <h1 className="min-w-0 flex-1 truncate text-[28px]">{email?.subject ?? ''}</h1>
      <div className="flex items-center gap-1">
        <IconButton label="Star" disabled>
          <Star size={20} />
        </IconButton>
        <IconButton label="Archive" disabled>
          <Archive size={20} />
        </IconButton>
        <IconButton label="Delete" disabled>
          <Trash2 size={20} />
        </IconButton>
      </div>
      <div className="mx-2 h-10 w-px bg-line" />
      {user && <Avatar name={user.name} src={user.avatarUrl} size={40} />}
    </header>
  );

  if (isLoading) return <FullPageSpinner />;
  if (error || !email) {
    return (
      <div>
        {header}
        <p className="px-20 text-sm text-red-600">{error?.message ?? 'Email not found'}</p>
      </div>
    );
  }

  const timeLabel = email.sentAt ? formatDateTime(email.sentAt) : `Scheduled · ${formatDateTime(email.scheduledAt)}`;

  return (
    <div className="h-full overflow-y-auto">
      {header}
      <article className="mx-auto max-w-[1320px] px-[60px] pb-16 pt-4">
        <div className="flex gap-5">
          <Avatar name={email.from.name} size={50} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[19px]">
                  <span className="font-semibold">{email.from.name}</span>{' '}
                  <span className="text-[15px] text-[#6b6b6b]">&lt;{email.from.email}&gt;</span>
                </p>
                <p className="mt-1 text-[15px] text-[#6b6b6b]">
                  to {displayRecipient(email.toName, email.toEmail)}
                  {email.toName && <> &lt;{email.toEmail}&gt;</>}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-[15px] text-[#6b6b6b]">{timeLabel}</span>
                <StatusBadge status={email.status} scheduledAt={email.scheduledAt} />
              </div>
            </div>

            {email.status === 'failed' && email.failedReason && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">Failed: {email.failedReason}</p>
            )}

            <div className="prose-email mt-7 text-[18px] leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />

            {email.previewUrl && (
              <a
                href={email.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-brand hover:bg-brand-soft"
              >
                <ExternalLink size={16} /> View delivered message on Ethereal
              </a>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
