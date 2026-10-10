'use client';

import { ArrowLeft } from 'lucide-react';

import { Button } from '../components/Button';
import { cn } from '../lib/cn';

import type { ComponentProps, ReactNode } from 'react';

const linkClasses =
  'inline-flex min-h-6 items-center cursor-pointer self-start rounded-sm border-0 bg-transparent p-0 text-[13px] font-semibold text-brand-text underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** A text button in a sign-in card: Forgot password?, Use a recovery code. */
export function LinkButton({ className, ...rest }: ComponentProps<'button'>) {
  return <button type="button" className={cn(linkClasses, className)} {...rest} />;
}

/** "← Back" at the top of a sign-in step. */
export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <LinkButton onClick={onClick} className="inline-flex items-center gap-1 text-ink-2">
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </LinkButton>
  );
}

/** A sign-in card's main button: full width and tall, as in the prototypes (`.btn.big`). */
export function BigButton({ className, ...rest }: ComponentProps<typeof Button>) {
  return <Button className={cn('h-[46px] w-full text-[14.5px]', className)} {...rest} />;
}

/** An error for the whole step, read out when it appears. */
export function StepError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="m-0 min-h-0 text-[13px] font-semibold text-bad empty:hidden">
      {children}
    </p>
  );
}

export interface ShowPasswordLabels {
  /** The visible text while hidden ("Show") and shown ("Hide"). */
  show: string;
  hide: string;
  /** The accessible names ("Show password", "Hide password"). */
  showLabel: string;
  hideLabel: string;
}

/** Show/Hide inside a password field (the prototypes' `.pw .linkbtn`). */
export function ShowPasswordButton({
  shown,
  onToggle,
  labels,
}: {
  shown: boolean;
  onToggle: () => void;
  labels: ShowPasswordLabels;
}) {
  return (
    <button
      type="button"
      aria-label={shown ? labels.hideLabel : labels.showLabel}
      aria-pressed={shown}
      onClick={onToggle}
      className="h-9 min-w-11 cursor-pointer rounded-md border-0 bg-transparent px-2 text-[12.5px] font-semibold text-brand-text focus-visible:outline-2 focus-visible:outline-focus"
    >
      {shown ? labels.hide : labels.show}
    </button>
  );
}
