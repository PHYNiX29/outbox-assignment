import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { EmailListItem } from '../../api/types';
import { displayRecipient, formatDateTime } from '../../utils/format';
import { StatusBadge } from '../ui/StatusBadge';

/** One row of the mailbox list: "To: name | badge | subject - preview | time | star". */
export const EmailRow = memo(function EmailRow({ email }: { email: EmailListItem }) {
  const time = email.sentAt ?? email.scheduledAt;
  return (
    <Link
      to={`/emails/${email.id}`}
      className="group flex h-[70px] items-center gap-4 border-b border-line px-[30px] text-[17px] hover:bg-[#fafafa]"
    >
      <span className="w-[230px] shrink-0 truncate" title={email.toEmail}>
        To: {displayRecipient(email.toName, email.toEmail)}
      </span>
      <StatusBadge status={email.status} scheduledAt={email.scheduledAt} />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{email.subject}</span>
        {email.preview && <span className="text-[#9a9a9a]"> - {email.preview}</span>}
      </span>
      {(email.status === 'sent' || email.status === 'failed') && (
        <span
          className="shrink-0 text-sm text-[#8a8a8a]"
          title={email.failedReason ?? undefined}
        >
          {formatDateTime(time)}
        </span>
      )}
      <Star size={20} className="shrink-0 text-[#c4c4c4]" />
    </Link>
  );
});
