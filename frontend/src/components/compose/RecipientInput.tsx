import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Recipient } from '../../api/types';
import { dedupeRecipients, isValidEmail, parseLeads } from '../../utils/parseLeads';

const VISIBLE_CHIPS = 3;

interface Props {
  value: Recipient[];
  onChange: (r: Recipient[]) => void;
  onFileLoaded: (fileName: string, count: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

/** "To" row: type emails (Enter / comma) or upload a CSV/TXT list. Shows chips + "+N". */
export function RecipientInput({ value, onChange, onFileLoaded, fileInputRef }: Props) {
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitDraft = () => {
    const parts = draft.split(/[\s,;]+/).filter(Boolean);
    if (!parts.length) return;
    const valid = parts.filter(isValidEmail);
    if (valid.length < parts.length) toast.error('Some addresses were invalid and skipped');
    onChange(dedupeRecipients([...value, ...valid.map((email) => ({ email }))]));
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const leads = parseLeads(await file.text());
    if (!leads.length) {
      toast.error('No email addresses found in that file');
      return;
    }
    const merged = dedupeRecipients([...value, ...leads]);
    onChange(merged);
    onFileLoaded(file.name, leads.length);
    toast.success(`Detected ${leads.length} email address${leads.length === 1 ? '' : 'es'}`);
  };

  const shown = expanded ? value : value.slice(0, VISIBLE_CHIPS);
  const hidden = value.length - shown.length;

  return (
    <div className="flex min-h-[52px] flex-1 items-center gap-3 border-b border-line py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" onClick={() => inputRef.current?.focus()}>
        {shown.map((r) => (
          <span
            key={r.email}
            title={r.name ?? undefined}
            className="group inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft px-3 py-0.5 text-base"
          >
            {r.email}
            <button
              type="button"
              aria-label={`Remove ${r.email}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((x) => x.email !== r.email));
              }}
              className="hidden text-[#4b4b4b] group-hover:inline"
            >
              <X size={14} />
            </button>
          </span>
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full border border-brand bg-brand-soft px-3 py-0.5 text-base"
          >
            +{hidden}
          </button>
        )}
        {expanded && value.length > VISIBLE_CHIPS && (
          <button type="button" onClick={() => setExpanded(false)} className="text-sm text-brand">
            Show less
          </button>
        )}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commitDraft}
          placeholder={value.length ? '' : 'recipient@example.com'}
          className="h-9 min-w-[200px] flex-1 bg-transparent text-lg outline-none placeholder:text-[#b0b0b0]"
        />
      </div>

      {value.length > 0 && (
        <span className="shrink-0 text-sm text-muted">
          {value.length} recipient{value.length === 1 ? '' : 's'}
        </span>
      )}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex shrink-0 items-center gap-2 px-3 text-lg text-brand hover:text-brand-dark"
      >
        <Upload size={18} /> Upload List
      </button>
      <input ref={fileInputRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={onFile} />
    </div>
  );
}
