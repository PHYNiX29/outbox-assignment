import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'outline' | 'soft' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  outline: 'border border-brand text-brand bg-white hover:bg-brand-soft',
  soft: 'bg-brand-soft text-ink hover:bg-[#d8eedf]',
  ghost: 'text-ink hover:bg-surface',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rounded?: 'full' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  leftIcon,
  rounded = 'lg',
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        rounded === 'full' ? 'rounded-full' : 'rounded-lg',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : leftIcon}
      {children}
    </button>
  );
}
