import { Clock, Loader2 } from 'lucide-react';
import type { EmailStatus } from '../../api/types';
import { formatBadgeTime } from '../../utils/format';
import { cn } from '../../utils/cn';

const pill = 'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-0.5 text-sm';

/** Orange time pill for scheduled, grey "Sent", red "Failed" – as in the Figma. */
export function StatusBadge({ status, scheduledAt }: { status: EmailStatus; scheduledAt: string }) {
  switch (status) {
    case 'scheduled':
      return (
        <span className={cn(pill, 'border-[#fbc88e] bg-[#fff1e3] text-[#c2410c]')}>
          <Clock size={14} />
          {formatBadgeTime(scheduledAt)}
        </span>
      );
    case 'sending':
      return (
        <span className={cn(pill, 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]')}>
          <Loader2 size={14} className="animate-spin" />
          Sending
        </span>
      );
    case 'sent':
      return <span className={cn(pill, 'border-[#e5e5e5] bg-[#f3f3f3] text-[#525252]')}>Sent</span>;
    case 'failed':
      return <span className={cn(pill, 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]')}>Failed</span>;
  }
}
