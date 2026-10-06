import { useRef, type KeyboardEvent } from 'react';

import { cn } from '../lib/cn';
import { focusRing } from '../lib/motion';

export type SegmentedTone = 'brand' | 'good' | 'warn' | 'bad' | 'info';

export interface SegmentedOption {
  value: string;
  label: string;
  /** Colour of the option when chosen, for example good for Present and bad for Absent. */
  tone?: SegmentedTone;
  disabled?: boolean;
}

export interface SegmentedProps {
  label: string;
  options: readonly SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Saturated tone fills fail 4.5:1 with white text (good is 4.3:1), so the chosen option is a soft tint with ink text and a tone ring. */
const onTone: Record<SegmentedTone, string> = {
  brand: 'bg-brand-fill text-brand-ink',
  good: 'bg-good-soft text-ink ring-2 ring-good ring-inset',
  warn: 'bg-warn-soft text-ink ring-2 ring-warn ring-inset',
  bad: 'bg-bad-soft text-ink ring-2 ring-bad ring-inset',
  info: 'bg-info-soft text-ink ring-2 ring-info ring-inset',
};

export function Segmented({ label, options, value, onChange, className }: SegmentedProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const tabStop = options.findIndex((o) => o.value === value && !o.disabled);

  const move = (event: KeyboardEvent, from: number): void => {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !back) return;
    event.preventDefault();
    const at = enabled.indexOf(from);
    const next = enabled[(at + (forward ? 1 : -1) + enabled.length) % enabled.length];
    const option = next === undefined ? undefined : options[next];
    if (next === undefined || !option) return;
    refs.current[next]?.focus();
    onChange(option.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex overflow-hidden rounded-lg border border-line-strong', className)}
    >
      {options.map((option, index) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={option.disabled}
            tabIndex={tabStop === index || (tabStop === -1 && index === enabled[0]) ? 0 : -1}
            onClick={() => {
              onChange(option.value);
            }}
            onKeyDown={(event) => {
              move(event, index);
            }}
            className={cn(
              'cursor-pointer border-r border-line px-[11px] py-[5px] text-xs font-bold last:border-r-0 max-sm:min-h-11',
              'disabled:cursor-not-allowed disabled:opacity-45 focus-visible:-outline-offset-2',
              focusRing,
              on ? onTone[option.tone ?? 'brand'] : 'bg-surface text-ink-2 hover:bg-surface-2',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
