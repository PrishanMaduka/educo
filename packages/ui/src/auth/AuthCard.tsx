'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface AuthCardProps {
  title: string;
  /** A line above the title, such as "Welcome back to {school}". */
  eyebrow?: string;
  /** The sentence under the title. */
  lede?: ReactNode;
  /** A control above the title, such as Back. */
  top?: ReactNode;
  /** An icon in a soft square above the title (Check your inbox). */
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * The sign-in card (the prototype's `.auth-card`): one step at a time, its title the page's only
 * `h1`. A new step's card fades in. When the step has no field that took focus (Check your inbox,
 * the recovery codes), focus moves to its title, so keyboard and screen reader users are not left
 * on the button the last step removed.
 */
export function AuthCard({ title, eyebrow, lede, top, icon, children, className }: AuthCardProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const active = document.activeElement;
    if (active === null || active === document.body) heading.current?.focus();
  }, []);
  return (
    <section
      aria-labelledby="auth-title"
      className={cn(
        'quad-fade-in flex w-full max-w-[440px] flex-col gap-3.5 rounded-card border border-line bg-surface p-8 shadow-card max-[860px]:p-[22px]',
        className,
      )}
    >
      {top}
      {icon ? (
        <div className="grid size-[60px] place-items-center rounded-[18px] bg-brand-soft text-brand-text">
          {icon}
        </div>
      ) : null}
      {eyebrow ? <p className="m-0 text-[13px] font-bold text-brand-text">{eyebrow}</p> : null}
      <h1
        id="auth-title"
        ref={heading}
        tabIndex={-1}
        className="m-0 font-display text-[30px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink outline-none max-[860px]:text-[26px]"
      >
        {title}
      </h1>
      {lede ? <p className="m-0 text-ink-2">{lede}</p> : null}
      {children}
    </section>
  );
}
