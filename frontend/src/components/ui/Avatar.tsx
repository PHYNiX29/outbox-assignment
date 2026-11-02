import { useState } from 'react';
import { cn } from '../../utils/cn';
import { initials } from '../../utils/format';

interface Props {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

/** Shows the image if available, otherwise coloured initials. */
export function Avatar({ name, src, size = 40, className }: Props) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.4 };

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        style={style}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    );
  }
  return (
    <span
      style={style}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-[#22c55e] font-medium text-white', className)}
    >
      {initials(name) || '?'}
    </span>
  );
}
