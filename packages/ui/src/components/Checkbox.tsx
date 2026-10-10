'use client';

import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { useId, type ComponentProps } from 'react';

import { cn } from '../lib/cn';
import { focusRing, ICON_STROKE, transition } from '../lib/motion';

export interface CheckboxProps extends Omit<ComponentProps<typeof RadixCheckbox.Root>, 'children'> {
  /** Visible label. Without it, pass `aria-label`. */
  label?: string;
}

export function Checkbox({ label, id, className, ...rest }: CheckboxProps) {
  const generated = useId();
  const controlId = id ?? generated;
  return (
    <span className="relative inline-flex items-center gap-2">
      <RadixCheckbox.Root
        id={controlId}
        className={cn(
          'relative grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-[5px] border border-field-line bg-surface text-brand-ink',
          'data-[state=checked]:border-brand-fill data-[state=checked]:bg-brand-fill data-[state=indeterminate]:border-brand-fill data-[state=indeterminate]:bg-brand-fill',
          'disabled:cursor-not-allowed disabled:opacity-50 after:absolute after:-inset-3.5 after:content-[""]',
          transition,
          focusRing,
          className,
        )}
        {...rest}
      >
        <RadixCheckbox.Indicator>
          {rest.checked === 'indeterminate' ? (
            <Minus aria-hidden="true" strokeWidth={ICON_STROKE + 0.6} className="size-3.5" />
          ) : (
            <Check aria-hidden="true" strokeWidth={ICON_STROKE + 0.6} className="size-3.5" />
          )}
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      {label ? (
        <label htmlFor={controlId} className="cursor-pointer text-[13px] font-semibold text-ink">
          {label}
        </label>
      ) : null}
    </span>
  );
}
