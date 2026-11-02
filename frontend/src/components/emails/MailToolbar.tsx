import { useState } from 'react';
import { Check, Filter, RotateCw, Search } from 'lucide-react';
import type { EmailStatus } from '../../api/types';
import { IconButton } from '../ui/IconButton';
import { Popover } from '../ui/Popover';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  statusOptions: { value: EmailStatus; label: string }[];
  status?: EmailStatus;
  onStatusChange: (s?: EmailStatus) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

/** Search bar + filter + refresh row at the top of each mailbox. */
export function MailToolbar({ search, onSearchChange, statusOptions, status, onStatusChange, onRefresh, refreshing }: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const options: { value?: EmailStatus; label: string }[] = [{ label: 'All' }, ...statusOptions];

  return (
    <div className="flex items-center gap-4">
      <label className="flex h-12 max-w-[842px] flex-1 items-center gap-2.5 rounded-full bg-surface px-5">
        <Search size={18} className="text-[#6b6b6b]" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search"
          className="h-full flex-1 bg-transparent text-[17px] outline-none placeholder:text-[#8a8a8a]"
        />
      </label>

      <div className="relative">
        <IconButton label="Filter by status" active={Boolean(status)} onClick={() => setFilterOpen((o) => !o)}>
          <Filter size={20} />
        </IconButton>
        <Popover open={filterOpen} onClose={() => setFilterOpen(false)} className="left-0 top-full mt-2 w-44 p-1.5">
          {options.map((o) => (
            <button
              key={o.label}
              onClick={() => {
                onStatusChange(o.value);
                setFilterOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface"
            >
              {o.label}
              {status === o.value && <Check size={16} className="text-brand" />}
            </button>
          ))}
        </Popover>
      </div>

      <IconButton label="Refresh" onClick={onRefresh}>
        <RotateCw size={20} className={refreshing ? 'animate-spin' : ''} />
      </IconButton>
    </div>
  );
}
