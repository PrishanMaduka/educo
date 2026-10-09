'use client';

import { Checkbox, Input, OtpBoxes } from '@quad/ui';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from './AuthCard';
import { AccountChip, BigButton, LinkButton, StepError } from './bits';

import type { SignInNext } from '@quad/contracts';

import { staffApi, unwrap } from '@/lib/api';
import { errorKeyFor, fieldError } from '@/lib/error-copy';

export interface TwoStepStepProps {
  email: string;
  inviteToken?: string;
  onAnswer: (next: SignInNext) => void;
  onChangeEmail: () => void;
}

const CODE = /^\d{6}$/;

/**
 * Step 3 (spec 05): the authenticator code (six boxes that fill themselves from a paste or
 * autofill, and send once full), or one of the 10 recovery codes, and "Trust this device for 30
 * days".
 */
export function TwoStepStep({ email, inviteToken, onAnswer, onChangeEmail }: TwoStepStepProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'app' | 'recovery'>('app');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [missing, setMissing] = useState<string | null>(null);
  const verify = useMutation({
    mutationFn: (proof: { code: string } | { recoveryCode: string }) =>
      unwrap(
        staffApi().POST('/api/v1/auth/totp/verify', {
          body: { ...proof, trustDevice, ...(inviteToken ? { inviteToken } : {}) },
        }),
      ),
    onSuccess: (result) => {
      onAnswer(result.next);
    },
    onError: () => {
      setCode('');
    },
  });

  const send = (value: string) => {
    if (verify.isPending) return;
    if (mode === 'app') {
      if (!CODE.test(value)) {
        setMissing(t('signIn.twoStep.missingCode'));
        return;
      }
      verify.mutate({ code: value });
    } else {
      if (value.trim() === '') {
        setMissing(t('signIn.twoStep.missingRecovery'));
        return;
      }
      verify.mutate({ recoveryCode: value.trim() });
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(mode === 'app' ? code : recoveryCode);
  };

  const apiError = verify.isError
    ? (fieldError(verify.error, mode === 'app' ? 'code' : 'recoveryCode') ??
      t(errorKeyFor(verify.error)))
    : undefined;
  const error = missing ?? apiError;

  return (
    <AuthCard
      title={t('signIn.twoStep.title')}
      lede={mode === 'app' ? t('signIn.twoStep.lede') : t('signIn.twoStep.recoveryLede')}
    >
      <AccountChip
        email={email}
        changeText={t('signIn.account.change')}
        changeLabel={t('signIn.account.changeLabel')}
        onChange={onChangeEmail}
      />
      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        {mode === 'app' ? (
          <OtpBoxes
            label={t('signIn.code.label')}
            digitLabel={(position, count) => t('signIn.code.digit', { position, count })}
            value={code}
            onChange={(value) => {
              setCode(value);
              setMissing(null);
            }}
            onComplete={send}
            disabled={verify.isPending}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the step exists to type this code
            autoFocus
          />
        ) : (
          <Input
            label={t('signIn.twoStep.recoveryLabel')}
            name="recovery-code"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- switching to a recovery code means typing one
            autoFocus
            value={recoveryCode}
            onChange={(event) => {
              setRecoveryCode(event.target.value);
              setMissing(null);
            }}
            className="h-11 font-mono"
          />
        )}
        <StepError>{error}</StepError>
        <Checkbox
          label={t('signIn.twoStep.trust')}
          checked={trustDevice}
          onCheckedChange={(checked) => {
            setTrustDevice(checked === true);
          }}
        />
        <BigButton type="submit" disabled={verify.isPending}>
          {t('signIn.twoStep.submit')}
        </BigButton>
      </form>
      <p className="m-0 flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-2">
        {mode === 'app' ? <span>{t('signIn.twoStep.noPhone')}</span> : null}
        <LinkButton
          onClick={() => {
            setMode(mode === 'app' ? 'recovery' : 'app');
            setMissing(null);
            verify.reset();
          }}
        >
          {mode === 'app' ? t('signIn.twoStep.useRecovery') : t('signIn.twoStep.useApp')}
        </LinkButton>
      </p>
    </AuthCard>
  );
}
