'use client';

import { OtpBoxes } from '@quad/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from './AuthCard';
import { BigButton, StepError } from './bits';
import { errorKeyFor, fieldError } from './error-copy';
import { QrCode } from './QrCode';

import type { SignInNext } from '@quad/contracts';

import { staffApi, unwrap } from '@/lib/api';

export interface TwoStepSetupProps {
  inviteToken?: string;
  onSetUp: (recoveryCodes: readonly string[], next: SignInNext | null) => void;
}

/** The key the authenticator app needs when the code cannot be scanned. */
function secretOf(otpauthUri: string): string {
  try {
    return new URL(otpauthUri).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

/** Groups of four, so the key is easier to type. */
const grouped = (secret: string) => secret.replace(/(.{4})(?=.)/g, '$1 ');

/**
 * Step 3, first time (spec 05): the school asks for two-step, so the person adds Quad to an
 * authenticator app (QR code or key) and confirms with its first code. The API then answers with
 * the 10 recovery codes, shown once.
 */
export function TwoStepSetup({ inviteToken, onSetUp }: TwoStepSetupProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [missing, setMissing] = useState(false);
  // A query, so React's double effects in development start one authenticator, not two.
  const started = useQuery({
    queryKey: ['me', 'totp', 'start'],
    queryFn: () =>
      unwrap(staffApi().POST('/api/v1/me/totp', { body: inviteToken ? { inviteToken } : {} })),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const confirm = useMutation({
    mutationFn: (value: string) =>
      unwrap(
        staffApi().POST('/api/v1/me/totp', {
          body: { code: value, ...(inviteToken ? { inviteToken } : {}) },
        }),
      ),
    onSuccess: (result) => {
      onSetUp(result.recoveryCodes ?? [], result.next);
    },
    onError: () => {
      setCode('');
    },
  });

  const send = (value: string) => {
    if (confirm.isPending) return;
    if (!/^\d{6}$/.test(value)) {
      setMissing(true);
      return;
    }
    confirm.mutate(value);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(code);
  };

  const uri = started.data?.otpauthUri ?? null;
  const error = missing
    ? t('signIn.twoStep.missingCode')
    : started.isError
      ? t(errorKeyFor(started.error))
      : confirm.isError
        ? (fieldError(confirm.error, 'code') ?? t(errorKeyFor(confirm.error)))
        : null;

  return (
    <AuthCard title={t('signIn.setup.title')} lede={t('signIn.setup.lede')}>
      {uri === null ? (
        <p className="m-0 text-[13px] text-ink-2" aria-live="polite">
          {started.isPending ? t('signIn.setup.loading') : null}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface-2 p-4">
          <QrCode text={uri} label={t('signIn.setup.qr')} />
          <p className="m-0 text-center text-[12.5px] text-ink-2">{t('signIn.setup.manual')}</p>
          <code className="rounded-md bg-surface px-2 py-1 text-center font-mono text-[13px] break-all text-ink">
            {grouped(secretOf(uri))}
          </code>
        </div>
      )}
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
          disabled={uri === null || confirm.isPending}
        />
        <StepError>{error}</StepError>
        <BigButton type="submit" disabled={uri === null || confirm.isPending}>
          {t('signIn.setup.submit')}
        </BigButton>
      </form>
    </AuthCard>
  );
}
