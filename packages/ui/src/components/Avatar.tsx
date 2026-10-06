import { cva, type VariantProps } from 'class-variance-authority';

import { avatarTone, initialsOf } from '../lib/avatar';
import { cn } from '../lib/cn';

import type { ComponentProps } from 'react';

const avatarVariants = cva('inline-grid flex-none place-items-center rounded-full font-bold', {
  variants: {
    size: {
      xs: 'size-[22px] text-[9px]',
      sm: 'size-7 text-[11px]',
      md: 'size-9 text-[13px]',
      lg: 'size-[72px] text-2xl',
    },
  },
  defaultVariants: { size: 'md' },
});

export interface AvatarProps
  extends Omit<ComponentProps<'span'>, 'children'>, VariantProps<typeof avatarVariants> {
  name: string;
  /** Hide from screen readers, when the name is already written next to the avatar. */
  decorative?: boolean;
}

export function Avatar({ name, size, decorative = false, className, ...rest }: AvatarProps) {
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      className={cn(avatarVariants({ size }), avatarTone(name).className, className)}
      {...rest}
    >
      {initialsOf(name)}
    </span>
  );
}
