import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

import type { ComponentProps } from 'react';

const pillVariants = cva(
  'inline-flex items-center gap-[5px] rounded-pill px-[9px] py-0.5 text-[11.5px] font-bold whitespace-nowrap text-ink',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2',
        brand: 'bg-brand-soft',
        good: 'bg-good-soft',
        warn: 'bg-warn-soft',
        bad: 'bg-bad-soft',
        info: 'bg-info-soft',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

/** The status dot carries the tone colour, the text stays ink so it passes AA in both themes. */
const dotTone = {
  neutral: 'bg-ink-3',
  brand: 'bg-brand',
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
} as const;

export interface PillProps extends ComponentProps<'span'>, VariantProps<typeof pillVariants> {
  /** Hide the status dot. */
  plain?: boolean;
}

export function Pill({ tone, plain = false, className, children, ...rest }: PillProps) {
  return (
    <span className={cn(pillVariants({ tone }), className)} {...rest}>
      {plain ? null : (
        <span
          aria-hidden="true"
          className={cn('size-1.5 rounded-full', dotTone[tone ?? 'neutral'])}
        />
      )}
      {children}
    </span>
  );
}
