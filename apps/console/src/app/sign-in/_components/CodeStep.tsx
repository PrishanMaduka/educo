'use client';

import { OtpBoxes } from '@quad/ui';
import { AuthCard, BackButton, BigButton, QrCode, StepError } from '@quad/ui/auth';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { PlatformSignInNext } from '@quad/contracts';

import { consoleApi, unwrap } from '@/lib/api';
import { messageFor } from '@/lib/error-copy';

const CODE = /^\d{6}$/;

/** Groups of four, so the key is easier to type. */
const grouped = (secret: string) => secret.replace(/(.{4})(?=.)/g, '$1 ');

export interface CodeStepProps {
  /** A first sign-in (or after an owner reset it): add Quad to an authenticator app first. */
  setup: boolean;
  email: string;
  onAnswer: (next: PlatformSignInNext) => void;
  onBack: () => void;
}

/**
 * Step 2 (spec 05): the authenticator's 6-digit code, always. On a first sign-in the card first
 * shows a new authenticator (QR code and key, `POST /platform/auth/totp/setup`); the first code
 * turns it on. The boxes send once full.
 */
export function CodeStep({ setup, email, onAnswer, onBack }: CodeStepProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [missing, setMissing] = useState(false);
  // A query, so React's double effects in development start one authenticator, not two. Each call
  // mints a new pending secret, so it never runs again by itself.
  const started = useQuery({
    queryKey: ['platform', 'totp', 'setup'],
    queryFn: () => unwrap(consoleApi().POST('/api/v1/platform/auth/totp/setup', { body: {} })),
    enabled: setup,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const verify = useMutation({
    mutationFn: (value: string) =>
      unwrap(consoleApi().POST('/api/v1/platform/auth/totp/verify', { body: { code: value } })),
    onSuccess: (result) => {
      onAnswer(result.next);
    },
    onError: () => {
      setCode('');
    },
  });

  const waiting = setup && started.data === undefined;
  const send = (value: string) => {
    if (verify.isPending || waiting) return;
    if (!CODE.test(value)) {
      setMissing(true);
      return;
    }
    verify.mutate(value);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(code);
  };

  const error = missing
    ? t('signIn.twoStep.missingCode')
    : started.isError
      ? messageFor(started.error, (key) => t(key))
      : verify.isError
        ? messageFor(verify.error, (key) => t(key))
        : null;

  return (
    <AuthCard
      top={<BackButton label={t('console.signIn.back')} onClick={onBack} />}
      title={setup ? t('signIn.setup.title') : t('signIn.twoStep.title')}
      lede={setup ? t('console.signIn.setupLede') : t('console.signIn.twoStepLede', { email })}
    >
      {setup ? (
        started.data === undefined ? (
          <p className="m-0 text-[13px] text-ink-2" aria-live="polite">
            {started.isPending ? t('signIn.setup.loading') : null}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface-2 p-4">
            <QrCode text={started.data.otpauthUri} label={t('signIn.setup.qr')} />
            <p className="m-0 text-center text-[12.5px] text-ink-2">{t('signIn.setup.manual')}</p>
            <code className="rounded-md bg-surface px-2 py-1 text-center font-mono text-[13px] break-all text-ink">
              {grouped(started.data.secret)}
            </code>
          </div>
        )
      ) : null}
      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <OtpBoxes
          label={t('signIn.code.label')}
          digitLabel={(position, count) => t('signIn.code.digit', { position, count })}
          value={code}
          onChange={(value) => {
            setCode(value);
            setMissing(false);
          }}
          onComplete={send}
          disabled={waiting || verify.isPending}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the step exists to type this code
          autoFocus={!setup}
        />
        <StepError>{error}</StepError>
        <BigButton type="submit" disabled={waiting || verify.isPending}>
          {setup ? t('signIn.setup.submit') : t('signIn.twoStep.submit')}
        </BigButton>
      </form>
    </AuthCard>
  );
}
