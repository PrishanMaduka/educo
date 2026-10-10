'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '../lib/cn';
import { uiText } from '../lib/defaults';
import { ICON_STROKE, transition } from '../lib/motion';

import { controlClasses, Field } from './Field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  /** Needed for screen readers when there is no visible `label`. */
  'aria-label'?: string;
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
  /** Use the browser's own select, for example on small phones or in long forms. */
  native?: boolean;
}

export function Select({
  label,
  'aria-label': ariaLabel,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = uiText['ui.select.placeholder'],
  hint,
  error,
  disabled,
  name,
  id,
  className,
  native = false,
}: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className} id={id}>
      {({ id: controlId, describedBy }) =>
        native ? (
          <select
            id={controlId}
            name={name}
            aria-label={ariaLabel}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            value={value}
            defaultValue={value === undefined ? (defaultValue ?? '') : undefined}
            onChange={(event) => {
              onValueChange(event.target.value);
            }}
            className={cn('h-9', controlClasses, error && 'border-bad')}
          >
            {value === undefined && defaultValue === undefined ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <RadixSelect.Root
            value={value}
            defaultValue={defaultValue}
            onValueChange={onValueChange}
            disabled={disabled}
            name={name}
          >
            <RadixSelect.Trigger
              id={controlId}
              aria-label={ariaLabel}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={cn(
                'inline-flex h-9 items-center justify-between gap-2 text-left',
                controlClasses,
                error && 'border-bad',
              )}
            >
              <RadixSelect.Value placeholder={placeholder} />
              <RadixSelect.Icon className="text-ink-3">
                <ChevronDown aria-hidden="true" strokeWidth={ICON_STROKE} className="size-4" />
              </RadixSelect.Icon>
            </RadixSelect.Trigger>
            <RadixSelect.Portal>
              <RadixSelect.Content
                position="popper"
                sideOffset={4}
                className="z-[200] max-h-[min(340px,55vh)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[14px] border border-line bg-surface p-1.5 shadow-lg"
              >
                <RadixSelect.Viewport>
                  {options.map((option) => (
                    <RadixSelect.Item
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] text-ink outline-none',
                        'data-[highlighted]:bg-surface-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[state=checked]:font-bold',
                        transition,
                      )}
                    >
                      <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                      <RadixSelect.ItemIndicator className="ml-auto text-brand-text">
                        <Check aria-hidden="true" strokeWidth={ICON_STROKE} className="size-4" />
                      </RadixSelect.ItemIndicator>
                    </RadixSelect.Item>
                  ))}
                </RadixSelect.Viewport>
              </RadixSelect.Content>
            </RadixSelect.Portal>
          </RadixSelect.Root>
        )
      }
    </Field>
  );
}
