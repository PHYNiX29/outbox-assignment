import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type Variant = 'filled' | 'boxed' | 'underline';

const variants: Record<Variant, string> = {
  // grey filled field (login page)
  filled: 'h-10 rounded-lg bg-surface px-4 text-sm placeholder:text-muted',
  // small bordered box (delay / hourly limit)
  boxed: 'h-10 w-20 rounded-lg border border-line px-3 text-base placeholder:text-[#c4c4c4]',
  // borderless field sitting on an underline row (compose)
  underline: 'h-10 w-full bg-transparent text-base placeholder:text-[#b0b0b0]',
};

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  variant?: Variant;
}

export const Input = forwardRef<HTMLInputElement, Props>(({ variant = 'filled', className, ...rest }, ref) => (
  <input
    ref={ref}
    className={cn('outline-none focus:ring-2 focus:ring-brand/20', variant === 'underline' && 'focus:ring-0', variants[variant], className)}
    {...rest}
  />
));
Input.displayName = 'Input';
