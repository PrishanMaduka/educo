import { cn } from '../lib/cn';

import { controlClasses, Field } from './Field';

import type { ComponentProps } from 'react';

export interface InputProps extends ComponentProps<'input'> {
  label?: string;
  hint?: string;
  error?: string;
  /** Class for the wrapping field. `className` goes on the input itself. */
  fieldClassName?: string;
}

export function Input({ label, hint, error, fieldClassName, className, id, ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} className={fieldClassName} id={id}>
      {({ id: controlId, describedBy }) => (
        <input
          id={controlId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn('h-9', controlClasses, error && 'border-bad', className)}
          {...rest}
        />
      )}
    </Field>
  );
}
