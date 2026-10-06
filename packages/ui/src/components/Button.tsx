import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';
import { focusRing, ICON_STROKE, transition } from '../lib/motion';

import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

export const buttonVariants = cva(
  [
    'inline-flex max-w-full items-center justify-center gap-[7px] rounded-lg border font-semibold whitespace-nowrap',
    'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-11',
    transition,
    focusRing,
  ],
  {
    variants: {
      variant: {
        primary:
          'border-brand-fill bg-brand-fill text-brand-ink hover:border-brand-fill-strong hover:bg-brand-fill-strong',
        secondary: 'border-line-strong bg-surface text-ink hover:bg-surface-2',
        ghost: 'border-transparent bg-transparent text-ink hover:bg-surface-2',
        danger: 'border-bad bg-bad text-surface hover:brightness-90',
      },
      size: {
        sm: 'h-[30px] px-2.5 text-xs',
        md: 'h-9 px-3.5 text-[13px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Optional leading icon. Decorative, so hidden from screen readers. */
  icon?: LucideIcon;
}

export function Button({
  variant,
  size,
  icon: Icon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...rest}>
      {Icon ? (
        <Icon aria-hidden="true" strokeWidth={ICON_STROKE} className="size-4 shrink-0" />
      ) : null}
      {children}
    </button>
  );
}
