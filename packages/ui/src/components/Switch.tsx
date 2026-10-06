import * as RadixSwitch from '@radix-ui/react-switch';
import { useId, type ComponentProps } from 'react';

import { cn } from '../lib/cn';
import { focusRing, transition } from '../lib/motion';

export interface SwitchProps extends Omit<ComponentProps<typeof RadixSwitch.Root>, 'children'> {
  /** Visible label. Without it, pass `aria-label`. */
  label?: string;
}

export function Switch({ label, id, className, ...rest }: SwitchProps) {
  const generated = useId();
  const controlId = id ?? generated;
  return (
    <div className="inline-flex items-center gap-2.5">
      <RadixSwitch.Root
        id={controlId}
        className={cn(
          'relative h-[22px] w-10 shrink-0 cursor-pointer rounded-pill bg-ink-3 data-[state=checked]:bg-brand-fill',
          'disabled:cursor-not-allowed disabled:opacity-50 max-sm:after:absolute max-sm:after:-inset-2.5 max-sm:after:content-[""]',
          transition,
          focusRing,
          className,
        )}
        {...rest}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block size-[18px] translate-x-0.5 rounded-full bg-surface shadow-card data-[state=checked]:translate-x-[20px] data-[state=checked]:bg-brand-ink',
            transition,
          )}
        />
      </RadixSwitch.Root>
      {label ? (
        <label htmlFor={controlId} className="cursor-pointer text-[13px] font-semibold text-ink">
          {label}
        </label>
      ) : null}
    </div>
  );
}
