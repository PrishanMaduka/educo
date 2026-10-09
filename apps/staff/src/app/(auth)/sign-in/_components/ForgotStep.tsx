'use client';

import { SignInEmail } from '@quad/contracts';
import { Input } from '@quad/ui';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from './AuthCard';
import { BackButton, BigButton, StepError } from './bits';

import { staffApi, unwrapEmpty } from '@/lib/api';
import { errorKeyFor, fieldError, isFieldError } from '@/lib/error-copy';

export interface ForgotStepProps {
  email: string;
  onSent: (email: string) => void;
  onBack: () => void;
}

/** Forgot password (spec 05 step 5): a signed link by email. The answer is the same for any address. */
export function ForgotStep({ email, onSent, onBack }: ForgotStepProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(email);
  const [invalid, setInvalid] = useState(false);
  const send = useMutation({
    mutationFn: (address: string) =>
      unwrapEmpty(staffApi().POST('/api/v1/auth/password/forgot', { body: { email: address } })),
    onSuccess: (_result, address) => {
      onSent(address);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = SignInEmail.safeParse(value);
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    send.mutate(parsed.data);
  };

  return (
    <AuthCard
      top={<BackButton label={t('signIn.back')} onClick={onBack} />}
      title={t('signIn.forgot.title')}
      lede={t('signIn.forgot.lede')}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <Input
          label={t('signIn.email.label')}
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the step exists to take this address
          autoFocus
          value={value}
          error={invalid ? t('signIn.email.invalid') : fieldError(send.error, 'email')}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
          className="h-11"
        />
        <StepError>
          {send.isError && !isFieldError(send.error) ? t(errorKeyFor(send.error)) : null}
        </StepError>
        <BigButton type="submit" disabled={send.isPending}>
          {t('signIn.forgot.submit')}
        </BigButton>
      </form>
    </AuthCard>
  );
}
