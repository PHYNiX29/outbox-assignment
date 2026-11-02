import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  active?: boolean;
}

export function IconButton({ label, children, active, className, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[#8a8a8a] transition-colors hover:bg-surface hover:text-ink disabled:opacity-50',
        active && 'text-brand hover:text-brand',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
