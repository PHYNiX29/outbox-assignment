import { cn } from '../../utils/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full items-center justify-center text-brand">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
