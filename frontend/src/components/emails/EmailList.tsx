import type { ReactNode } from 'react';
import type { EmailListItem } from '../../api/types';
import { EmailRow } from './EmailRow';

function SkeletonRow() {
  return (
    <div className="flex h-[70px] animate-pulse items-center gap-4 border-b border-line px-[30px]">
      <div className="h-4 w-40 rounded bg-surface" />
      <div className="h-6 w-28 rounded-full bg-surface" />
      <div className="h-4 flex-1 rounded bg-surface" />
    </div>
  );
}

interface Props {
  items: EmailListItem[] | undefined;
  loading: boolean;
  error: Error | null;
  empty: ReactNode;
}

export function EmailList({ items, loading, error, empty }: Props) {
  if (loading && !items) {
    return (
      <div>
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }
  if (error && !items) {
    return <p className="px-[30px] py-10 text-sm text-red-600">Could not load emails: {error.message}</p>;
  }
  if (!items?.length) return <>{empty}</>;
  return (
    <div>
      {items.map((e) => (
        <EmailRow key={e.id} email={e} />
      ))}
    </div>
  );
}
