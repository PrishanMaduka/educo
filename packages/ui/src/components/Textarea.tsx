'use client';

import { cn } from '../lib/cn';

import { controlClasses, Field } from './Field';

import type { ComponentProps } from 'react';

export interface TextareaProps extends ComponentProps<'textarea'> {
  label?: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
}

export function Textarea({
  label,
  hint,
  error,
  fieldClassName,
  className,
  id,
  rows = 4,
  ...rest
}: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} className={fieldClassName} id={id}>
      {({ id: controlId, describedBy }) => (
        <textarea
          id={controlId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn('py-2', controlClasses, error && 'border-bad', className)}
          {...rest}
        />
      )}
    </Field>
  );
}
