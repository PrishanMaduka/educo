'use client';

import { useId } from 'react';

import { cn } from '../lib/cn';
import { focusRing } from '../lib/motion';

import type { ReactNode } from 'react';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  /** Receives the ids to wire the control to its label and messages. */
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
  id?: string;
}

/** Label, control slot, hint and error message for form controls. Internal building block of Input, Textarea and Select. */
export function Field({ label, hint, error, className, children, id: idProp }: FieldProps) {
  const generated = useId();
  const id = idProp ?? generated;
  // The hint gives way to an error, so it is only referenced while it is shown.
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex min-w-0 flex-col gap-[5px]', className)}>
      {label ? (
        <label htmlFor={id} className="text-xs font-bold text-ink-2">
          {label}
        </label>
      ) : null}
      {children({ id, describedBy })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const controlClasses =
  'w-full min-w-0 rounded-lg border border-line-strong bg-surface px-[11px] text-ink placeholder:text-ink-2 ' +
  'focus-visible:border-brand ' +
  focusRing +
  ' ' +
  'disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-11';
