import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, SearchX, Send } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, useEmails } from '../api/hooks';
import type { EmailStatus, Folder } from '../api/types';
import { EmailList } from '../components/emails/EmailList';
import { MailToolbar } from '../components/emails/MailToolbar';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { IconButton } from '../components/ui/IconButton';
import { useDebounce } from '../hooks/useDebounce';

const FOLDER_CONFIG: Record<
  Folder,
  { statusOptions: { value: EmailStatus; label: string }[]; emptyTitle: string; emptyText: string; icon: JSX.Element }
> = {
  scheduled: {
    statusOptions: [
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'sending', label: 'Sending' },
    ],
    emptyTitle: 'No scheduled emails',
    emptyText: 'Emails you schedule will show up here until they are sent.',
    icon: <Clock size={26} />,
  },
  sent: {
    statusOptions: [
      { value: 'sent', label: 'Sent' },
      { value: 'failed', label: 'Failed' },
    ],
    emptyTitle: 'No sent emails yet',
    emptyText: 'Once scheduled emails go out, they will be listed here.',
    icon: <Send size={26} />,
  },
};

/** Shared page for both the Scheduled and Sent folders. */
export function MailboxPage({ folder }: { folder: Folder }) {
  const cfg = FOLDER_CONFIG[folder];
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmailStatus>();
  const q = useDebounce(search.trim(), 300);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, status]);
  const { data, isLoading, isFetching, error, refetch } = useEmails(folder, q, status, page);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const empty = q ? (
    <EmptyState icon={<SearchX size={26} />} title="No matches" description={`Nothing found for “${q}”.`} />
  ) : (
    <EmptyState
      icon={cfg.icon}
      title={cfg.emptyTitle}
      description={cfg.emptyText}
      action={
        <Button variant="outline" rounded="full" onClick={() => navigate('/compose')}>
          Compose new email
        </Button>
      }
    />
  );

  return (
    <div>
      <MailToolbar
        search={search}
        onSearchChange={setSearch}
        statusOptions={cfg.statusOptions}
        status={status}
        onStatusChange={setStatus}
        refreshing={isFetching}
        onRefresh={() => {
          void refetch();
          void qc.invalidateQueries({ queryKey: queryKeys.stats });
        }}
      />
      <div className="mt-5">
        {q && data?.engine && (
          <p className="px-[30px] pb-2 text-xs text-muted">
            {data.total} result{data.total === 1 ? '' : 's'} · searched with {data.engine}
          </p>
        )}
        <EmailList items={data?.items} loading={isLoading} error={error} empty={empty} />
        {data && pages > 1 && (
          <div className="flex items-center justify-end gap-2 px-[30px] py-4 text-sm text-muted">
            {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of {data.total}
            <IconButton label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={18} />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
}
