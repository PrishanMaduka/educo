'use client';

import { Input } from '@quad/ui';
import { AuthCard, BigButton, ShowPasswordButton, StepError } from '@quad/ui/auth';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { PlatformSignInNext } from '@quad/contracts';

import { consoleApi, unwrap } from '@/lib/api';
import { messageFor } from '@/lib/error-copy';

const EMAIL = /^\S+@\S+\.\S+$/;

export interface CredentialsStepProps {
  /** Kept by the flow, so Back from the code keeps the address. */
  email: string;
  onEmailChange: (email: string) => void;
  onAnswer: (next: PlatformSignInNext) => void;
}

/** Step 1 (the prototype's `platformAuth`): Quad email and password together. */
export function CredentialsStep({ email, onEmailChange, onAnswer }: CredentialsStepProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [problem, setProblem] = useState<'email' | 'password' | null>(null);
  const signIn = useMutation({
    mutationFn: () =>
      unwrap(
        consoleApi().POST('/api/v1/platform/auth/password', {
          body: { email: email.trim(), password },
        }),
      ),
    onSuccess: (result) => {
      onAnswer(result.next);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setProblem('email');
      return;
    }
    if (password === '') {
      setProblem('password');
      return;
    }
    setProblem(null);
    signIn.mutate();
  };

  return (
    <AuthCard title={t('console.signIn.title')} lede={t('console.signIn.lede')}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <Input
          label={t('console.signIn.email')}
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the page exists to sign in
          autoFocus
          value={email}
          error={problem === 'email' ? t('console.signIn.emailInvalid') : undefined}
          onChange={(event) => {
            onEmailChange(event.target.value);
            setProblem(null);
          }}
          className="h-11"
        />
        <Input
          label={t('signIn.password.label')}
          type={shown ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          value={password}
          error={problem === 'password' ? t('signIn.password.missing') : undefined}
          onChange={(event) => {
            setPassword(event.target.value);
            setProblem(null);
          }}
          className="h-11"
          end={
            <ShowPasswordButton
              shown={shown}
              onToggle={() => {
                setShown((value) => !value);
              }}
              labels={{
                show: t('signIn.password.show'),
                hide: t('signIn.password.hide'),
                showLabel: t('signIn.password.showLabel'),
                hideLabel: t('signIn.password.hideLabel'),
              }}
            />
          }
        />
        <StepError>{signIn.isError ? messageFor(signIn.error, (key) => t(key)) : null}</StepError>
        <BigButton type="submit" disabled={signIn.isPending}>
          {t('console.signIn.submit')}
        </BigButton>
      </form>
    </AuthCard>
  );
}
