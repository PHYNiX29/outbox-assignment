import { useEffect, useState } from 'react';
import { Popover } from '../ui/Popover';
import { Button } from '../ui/Button';
import { toDatetimeLocal } from '../../utils/format';
import { cn } from '../../utils/cn';

interface Props {
  open: boolean;
  value: Date | null;
  onClose: () => void;
  onDone: (d: Date | null) => void;
}

const tomorrowAt = (h: number) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, 0, 0, 0);
  return d;
};

const PRESETS = [
  { label: 'Tomorrow', date: () => tomorrowAt(9) },
  { label: 'Tomorrow, 10:00 AM', date: () => tomorrowAt(10) },
  { label: 'Tomorrow, 11:00 AM', date: () => tomorrowAt(11) },
  { label: 'Tomorrow, 3:00 PM', date: () => tomorrowAt(15) },
];

/** "Send Later" panel from the Figma: date-time picker + quick presets. */
export function SendLaterPopover({ open, value, onClose, onDone }: Props) {
  const [draft, setDraft] = useState(value ? toDatetimeLocal(value) : '');

  useEffect(() => {
    if (open) setDraft(value ? toDatetimeLocal(value) : '');
  }, [open, value]);

  return (
    <Popover open={open} onClose={onClose} className="right-0 top-full mt-3 flex min-h-[460px] w-[400px] flex-col p-5">
      <h3 className="text-[19px] font-medium">Send Later</h3>
      <input
        type="datetime-local"
        value={draft}
        min={toDatetimeLocal(new Date())}
        onChange={(e) => setDraft(e.target.value)}
        className={cn(
          'mt-6 border-b border-line pb-3 text-[17px] outline-none',
          draft ? 'text-ink' : 'text-[#8a8a8a]',
        )}
        aria-label="Pick date & time"
      />
      <div className="mt-4 flex flex-col">
        {PRESETS.map((p) => {
          const v = toDatetimeLocal(p.date());
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setDraft(v)}
              className={cn(
                'rounded-lg px-1 py-2.5 text-left text-[17px] hover:bg-surface',
                draft === v ? 'text-brand' : 'text-[#3a3a3a]',
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="mt-auto flex items-center justify-end gap-4 pt-6">
        <button
          type="button"
          className="px-4 text-[17px]"
          onClick={() => {
            onDone(null);
            onClose();
          }}
        >
          Cancel
        </button>
        <Button
          variant="outline"
          rounded="full"
          size="lg"
          className="w-[106px]"
          onClick={() => {
            onDone(draft ? new Date(draft) : null);
            onClose();
          }}
        >
          Done
        </Button>
      </div>
    </Popover>
  );
}
