'use client';

import { buttonVariants, cn } from '@quad/ui';
import { LinkButton, ShowPasswordButton as SharedShowPasswordButton } from '@quad/ui/auth';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import type { ReactNode } from 'react';

/** The generic sign-in card parts live in `@quad/ui/auth` (shared with the console, D50). */
export { BackButton, BigButton, LinkButton, StepError } from '@quad/ui/auth';

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

/** Show/Hide inside a password field, with the sign-in page's words. */
export function ShowPasswordButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <SharedShowPasswordButton
      shown={shown}
      onToggle={onToggle}
      labels={{
        show: t('signIn.password.show'),
        hide: t('signIn.password.hide'),
        showLabel: t('signIn.password.showLabel'),
        hideLabel: t('signIn.password.hideLabel'),
      }}
    />
  );
}
