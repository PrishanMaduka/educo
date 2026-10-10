'use client';

import { Input } from '@quad/ui';
import { AuthCard } from '@quad/ui/auth';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { BigButton, BigLink, ShowPasswordButton, StepError } from '../../../_components/bits';
import { InvalidLink } from '../../../_components/InvalidLink';

import { ApiError, staffApi, unwrapEmpty } from '@/lib/api';
import { errorKeyFor, fieldError, isFieldError } from '@/lib/error-copy';

/**
 * The password reset link (spec 05 step 5): choose a new password. The API checks the link
 * first, so a refused link says only that it is not valid any more; a weak or breached password
 * keeps the link usable.
 */
export function ResetPassword({ token }: { token: string }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [missing, setMissing] = useState(false);
  const reset = useMutation({
    mutationFn: () =>
      unwrapEmpty(staffApi().POST('/api/v1/auth/password/reset', { body: { token, password } })),
  });

  if (reset.error instanceof ApiError && reset.error.code === 'invalid_link') {
    return <InvalidLink />;
  }
  if (reset.isSuccess) {
    return (
      <AuthCard title={t('reset.done.title')} lede={t('reset.done.body')}>
        <BigLink href="/sign-in" variant="primary">
          {t('signIn.password.submit')}
        </BigLink>
      </AuthCard>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password === '') {
      setMissing(true);
      return;
    }
    reset.mutate();
  };

  return (
    <AuthCard title={t('reset.title')} lede={t('reset.lede')}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <Input
          label={t('reset.label')}
          type={shown ? 'text' : 'password'}
          name="new-password"
          autoComplete="new-password"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the page exists to take the new password
          autoFocus
          value={password}
          error={missing ? t('signIn.password.missing') : fieldError(reset.error, 'password')}
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
        <StepError>
          {reset.isError && !isFieldError(reset.error) ? t(errorKeyFor(reset.error)) : null}
        </StepError>
        <BigButton type="submit" disabled={reset.isPending}>
          {t('reset.submit')}
        </BigButton>
      </form>
    </AuthCard>
  );
}
