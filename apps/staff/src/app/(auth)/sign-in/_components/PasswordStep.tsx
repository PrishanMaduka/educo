'use client';

import { Checkbox, Input } from '@quad/ui';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from './AuthCard';
import { AccountChip, BigButton, LinkButton, ShowPasswordButton, StepError } from './bits';
import { errorKeyFor, fieldError, isFieldError } from './error-copy';

import type { SignInNext } from '@quad/contracts';

import { staffApi, unwrap } from '@/lib/api';

export interface PasswordStepProps {
  email: string;
  /** A staff invite link's token, sent as a hint (Task 13): the invited school counts. */
  inviteToken?: string;
  onAnswer: (next: SignInNext) => void;
  onChangeEmail: () => void;
  onForgot: () => void;
}

/** Step 2 (spec 05): the password, with Show/Hide and "Keep me signed in on this device". */
export function PasswordStep({
  email,
  inviteToken,
  onAnswer,
  onChangeEmail,
  onForgot,
}: PasswordStepProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [missing, setMissing] = useState(false);
  const signIn = useMutation({
    mutationFn: () =>
      unwrap(
        staffApi().POST('/api/v1/auth/password', {
          body: { email, password, keepSignedIn, ...(inviteToken ? { inviteToken } : {}) },
        }),
      ),
    onSuccess: (result) => {
      onAnswer(result.next);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password === '') {
      setMissing(true);
      return;
    }
    signIn.mutate();
  };

  const passwordError = missing
    ? t('signIn.password.missing')
    : fieldError(signIn.error, 'password');
  const stepError =
    signIn.isError && !isFieldError(signIn.error) ? t(errorKeyFor(signIn.error)) : null;

  return (
    <AuthCard title={t('signIn.password.title')}>
      <AccountChip
        email={email}
        changeText={t('signIn.account.change')}
        changeLabel={t('signIn.account.changeLabel')}
        onChange={onChangeEmail}
      />
      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <Input
          label={t('signIn.password.label')}
          type={shown ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the step exists to take the password
          autoFocus
          value={password}
          error={passwordError}
          onChange={(event) => {
            setPassword(event.target.value);
            setMissing(false);
          }}
          className="h-11"
          end={
            <ShowPasswordButton
              shown={shown}
              onToggle={() => {
                setShown((value) => !value);
              }}
            />
          }
        />
        <LinkButton onClick={onForgot}>{t('signIn.password.forgot')}</LinkButton>
        <Checkbox
          label={t('signIn.password.keep')}
          checked={keepSignedIn}
          onCheckedChange={(checked) => {
            setKeepSignedIn(checked === true);
          }}
        />
        <StepError>{stepError}</StepError>
        <BigButton type="submit" disabled={signIn.isPending}>
          {t('signIn.password.submit')}
        </BigButton>
      </form>
    </AuthCard>
  );
}
