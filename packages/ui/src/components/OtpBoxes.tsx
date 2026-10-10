'use client';

import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

import { cn } from '../lib/cn';
import { transition } from '../lib/motion';

export interface OtpBoxesProps {
  /** The digits so far; an empty box is a space (`'12 4'`), trailing spaces dropped. */
  value: string;
  onChange: (value: string) => void;
  /** Called with the code each time every box holds a digit (typing, paste or autofill). */
  onComplete?: (code: string) => void;
  /** The group's accessible name, for example "6-digit code". */
  label: string;
  /** Each box's accessible name, for example "Digit 2 of 6". */
  digitLabel: (position: number, count: number) => string;
  length?: number;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

const digitsOf = (value: string, length: number): string[] =>
  Array.from({ length }, (_, index) => {
    const char = value[index] ?? '';
    return /^\d$/.test(char) ? char : '';
  });

const joinDigits = (digits: string[]): string =>
  digits
    .map((digit) => digit || ' ')
    .join('')
    .trimEnd();

/**
 * One box per digit of a one-time code (spec 05 two-step; the prototype's `.otp`). Typing moves
 * to the next box, Backspace in an empty box goes back, and a pasted or autofilled code fills
 * the boxes from where it lands. Every box offers `autocomplete="one-time-code"`.
 */
export function OtpBoxes({
  value,
  onChange,
  onComplete,
  label,
  digitLabel,
  length = 6,
  error,
  disabled,
  autoFocus,
  className,
}: OtpBoxesProps) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const errorId = useId();
  const digits = digitsOf(value, length);

  const focusBox = (index: number) => {
    boxes.current[Math.max(0, Math.min(length - 1, index))]?.focus();
  };

  const update = (next: string[]) => {
    const joined = joinDigits(next);
    onChange(joined);
    if (next.every((digit) => digit !== '')) onComplete?.(joined);
  };

  /** Writes `incoming` digits from box `start` on, and moves to the box after the last one. */
  const fillFrom = (start: number, incoming: string) => {
    const next = [...digits];
    const written = incoming.slice(0, length - start).split('');
    written.forEach((digit, offset) => {
      next[start + offset] = digit;
    });
    update(next);
    focusBox(start + written.length);
  };

  const onInput = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    const previous = digits[index] ?? '';
    if (clean === '') {
      // A non-digit typed into an empty box changes nothing; clearing a box empties it.
      if (raw === '' && previous !== '') {
        const next = [...digits];
        next[index] = '';
        update(next);
      }
      return;
    }
    if (previous !== '' && clean.length === 2) {
      // A digit typed into a full box replaces it.
      fillFrom(index, clean.startsWith(previous) ? clean.slice(1) : clean.slice(0, 1));
      return;
    }
    fillFrom(index, clean);
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && digits[index] === '' && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      update(next);
      focusBox(index - 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const onPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    event.preventDefault();
    if (pasted !== '') fillFrom(index, pasted);
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div role="group" aria-label={label} className="flex gap-2">
        {digits.map((digit, index) => (
          <input
            // The boxes are fixed positions, so the index is their identity.
            key={index}
            ref={(element) => {
              boxes.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            aria-label={digitLabel(index + 1, length)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the code step exists to type this code
            autoFocus={autoFocus === true && index === 0}
            disabled={disabled}
            value={digit}
            onChange={(event) => {
              onInput(index, event.target.value);
            }}
            onKeyDown={(event) => {
              onKeyDown(index, event);
            }}
            onPaste={(event) => {
              onPaste(index, event);
            }}
            onFocus={(event) => {
              event.target.select();
            }}
            className={cn(
              'h-14 w-full min-w-0 flex-1 basis-0 rounded-input border-[1.5px] border-field-line bg-surface-2 text-center text-[22px] font-bold text-ink',
              'outline-none focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/25',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-bad',
              transition,
            )}
          />
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
