'use client';

import { cn } from '../lib/cn';

import { controlClasses, Field } from './Field';

import type { ComponentProps, ReactNode } from 'react';

export interface InputProps extends ComponentProps<'input'> {
  label?: string;
  /** A small action on the label's row, such as Forgot password? (see Field). */
  labelAside?: ReactNode;
  hint?: string;
  error?: string;
  /** Class for the wrapping field. `className` goes on the input itself. */
  fieldClassName?: string;
  /** A small control inside the field at its end, such as a Show password button. */
  end?: ReactNode;
}

export function Input({
  label,
  labelAside,
  hint,
  error,
  fieldClassName,
  className,
  id,
  end,
  ...rest
}: InputProps) {
  return (
    <Field
      label={label}
      labelAside={labelAside}
      hint={hint}
      error={error}
      className={fieldClassName}
      id={id}
    >
      {({ id: controlId, describedBy }) => {
        const input = (
          <input
            id={controlId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn('h-9', controlClasses, error && 'border-bad', end && 'pr-16', className)}
            {...rest}
          />
        );
        if (end === undefined || end === null) return input;
        return (
          <div className="relative">
            {input}
            <div className="absolute inset-y-0 right-1 flex items-center">{end}</div>
          </div>
        );
      }}
    </Field>
  );
}
