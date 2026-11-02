import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/** Absolutely positioned panel that closes on outside click / Escape. Parent must be `relative`. */
export function Popover({ open, onClose, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-30 rounded-xl border border-line bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
