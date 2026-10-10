'use client';

import { SignInEmail } from '@quad/contracts';
import { Input } from '@quad/ui';
import { AuthCard } from '@quad/ui/auth';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { BigButton } from './bits';

import type { SignInNotice } from '@/lib/session';

export interface EmailStepProps {
  email: string;
  /** The school remembered on this device (`quad_last_school`): shown, never chosen. */
  lastSchool: string | null;
  /** A fixed sentence saying why the person is signing in again (Switch school's two-step). */
  notice?: SignInNotice | null;
  onSubmit: (email: string) => void;
  /** Replaces the title and lede, for the invite page. */
  title?: string;
  lede?: string;
}

/** Step 1 (spec 05): the work email. Nothing is looked up; the password always comes next. */
export function EmailStep({
  email,
  lastSchool,
  notice = null,
  onSubmit,
  title,
  lede,
}: EmailStepProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(email);
  const [error, setError] = useState<string | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = SignInEmail.safeParse(value);
    if (!parsed.success) {
      setError(t('signIn.email.invalid'));
      return;
    }
    onSubmit(parsed.data);
  };

  return (
    <AuthCard
      eyebrow={lastSchool === null ? undefined : t('signIn.welcomeBack', { school: lastSchool })}
      title={title ?? t('signIn.title')}
      lede={lede ?? t('signIn.lede')}
    >
      {notice === 'two_step' ? (
        <p
          role="status"
          className="m-0 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink"
        >
          {t('signIn.notice.twoStep')}
        </p>
      ) : null}
      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <Input
          label={t('signIn.email.label')}
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          placeholder={t('signIn.email.placeholder')}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the page exists to take this address
          autoFocus
          value={value}
          error={error}
          onChange={(event) => {
            setValue(event.target.value);
            setError(undefined);
          }}
          className="h-11"
        />
        <BigButton type="submit">{t('signIn.email.submit')}</BigButton>
      </form>
      <p className="m-0 text-[13px] text-ink-2">{t('signIn.parents')}</p>
    </AuthCard>
  );
}
