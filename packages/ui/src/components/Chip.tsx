import { cn } from '../lib/cn';
import { focusRing, transition } from '../lib/motion';

import type { ComponentProps } from 'react';

export interface ChipProps extends Omit<ComponentProps<'button'>, 'aria-pressed'> {
  selected?: boolean;
  /** How many records the chip would show. */
  count?: number;
}

export function Chip({
  selected = false,
  count,
  className,
  type = 'button',
  children,
  ...rest
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex cursor-pointer items-center rounded-pill border px-3 py-1 text-[12.5px] font-semibold max-sm:min-h-11',
        selected
          ? 'border-brand-fill bg-brand-fill text-brand-ink'
          : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2',
        transition,
        focusRing,
        className,
      )}
      {...rest}
    >
      {children}
      {count === undefined ? null : (
        <span className="ml-1.5 font-normal tabular-nums">{count}</span>
      )}
    </button>
  );
}
