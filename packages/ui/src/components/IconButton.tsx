import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';
import { focusRing, ICON_STROKE, transition } from '../lib/motion';

import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

const iconButtonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center rounded-lg border cursor-pointer',
    'disabled:cursor-not-allowed disabled:opacity-50 max-sm:size-11',
    transition,
    focusRing,
  ],
  {
    variants: {
      variant: {
        secondary: 'border-line-strong bg-surface text-ink hover:bg-surface-2',
        ghost: 'border-transparent bg-transparent text-ink hover:bg-surface-2',
      },
      size: { sm: 'size-[30px]', md: 'size-9' },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface IconButtonProps
  extends Omit<ComponentProps<'button'>, 'aria-label'>, VariantProps<typeof iconButtonVariants> {
  icon: LucideIcon;
  /** The accessible name. The icon is the only content, so this is required. */
  label: string;
}

export function IconButton({
  icon: Icon,
  label,
  variant,
  size,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...rest}
    >
      <Icon aria-hidden="true" strokeWidth={ICON_STROKE} className="size-[18px]" />
    </button>
  );
}
