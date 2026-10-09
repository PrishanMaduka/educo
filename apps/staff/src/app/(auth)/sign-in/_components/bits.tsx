'use client';

import { Button, buttonVariants, cn } from '@quad/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import type { ComponentProps, ReactNode } from 'react';

const linkClasses =
  'inline-flex min-h-6 items-center cursor-pointer self-start rounded-sm border-0 bg-transparent p-0 text-[13px] font-semibold text-brand-strong underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

/** A text button in the card: Forgot password?, Use a recovery code. */
export function LinkButton({ className, ...rest }: ComponentProps<'button'>) {
  return <button type="button" className={cn(linkClasses, className)} {...rest} />;
}

/** "← Back" at the top of a step. */
export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <LinkButton onClick={onClick} className="inline-flex items-center gap-1 text-ink-2">
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </LinkButton>
  );
}

/** The card's main button: full width and tall, as in the prototype (`.btn.big`). */
export function BigButton({ className, ...rest }: ComponentProps<typeof Button>) {
  return <Button className={cn('h-[46px] w-full text-[14.5px]', className)} {...rest} />;
}

/** A link that looks like `BigButton`, for a step whose action goes to another page. */
export function BigLink({
  href,
  variant = 'secondary',
  children,
}: {
  href: string;
  variant?: 'primary' | 'secondary';
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant }), 'h-[46px] w-full text-[14.5px]')}>
      {children}
    </Link>
  );
}

/** An error for the whole step, read out when it appears. */
export function StepError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="m-0 min-h-0 text-[13px] font-semibold text-bad empty:hidden">
      {children}
    </p>
  );
}

/** The address being signed in, with Change (the landing prototype's `.acct`). */
export function AccountChip({
  email,
  changeLabel,
  changeText,
  onChange,
}: {
  email: string;
  changeLabel: string;
  changeText: string;
  onChange: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
      <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink">{email}</span>
      <LinkButton onClick={onChange} className="self-center">
        {changeText}
        <span className="sr-only">: {changeLabel}</span>
      </LinkButton>
    </div>
  );
}

/** Show/Hide inside a password field (the prototype's `.pw .linkbtn`). */
export function ShowPasswordButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={shown ? t('signIn.password.hideLabel') : t('signIn.password.showLabel')}
      aria-pressed={shown}
      onClick={onToggle}
      className="h-9 min-w-11 cursor-pointer rounded-md border-0 bg-transparent px-2 text-[12.5px] font-semibold text-brand-strong focus-visible:outline-2 focus-visible:outline-brand"
    >
      {shown ? t('signIn.password.hide') : t('signIn.password.show')}
    </button>
  );
}
