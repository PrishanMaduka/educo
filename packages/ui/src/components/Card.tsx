'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface CardProps extends Omit<ComponentProps<'section'>, 'title'> {
  /** Heading of the card. It also names the section for screen readers. */
  title?: string;
  /** Buttons or links shown at the end of the header. */
  actions?: ReactNode;
  /** Drop the body padding, for tables and lists that go edge to edge. */
  flush?: boolean;
}

export function Card({ title, actions, flush = false, className, children, ...rest }: CardProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cn('min-w-0 rounded-card border border-line bg-surface shadow-card', className)}
      {...rest}
    >
      {title || actions ? (
        <header className="flex items-center gap-2.5 border-b border-line px-[18px] py-3.5">
          {title ? (
            <h2 id={headingId} className="flex-1 font-display text-[15px] font-bold text-ink">
              {title}
            </h2>
          ) : (
            <span className="flex-1" />
          )}
          {actions}
        </header>
      ) : null}
      <div className={flush ? undefined : 'px-[18px] py-4'}>{children}</div>
    </section>
  );
}
