'use client';

import { Input } from '@quad/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '../../../_components/AuthCard';
import { BigButton, BigLink, ShowPasswordButton, StepError } from '../../../_components/bits';
import { InvalidLink } from '../../../_components/InvalidLink';
import { initialSignIn, stepFor, type SignInState } from '../../../_components/sign-in-steps';
import { SignInFlow } from '../../../_components/SignInFlow';

import type { MessageKey } from '@/i18n';
import type { InviteDetails, SignInNext } from '@quad/contracts';

import { ApiError, staffApi, unwrap } from '@/lib/api';
import { errorKeyFor, fieldError, isFieldError } from '@/lib/error-copy';

/** What accepting can answer besides a bad link, in the invitee's words. */
const ACCEPT_ERRORS: Readonly<Record<string, MessageKey>> = {
  unauthorized: 'error.invite.signInFirst',
  forbidden: 'error.invite.otherAccount',
};

const acceptErrorKey = (error: unknown): MessageKey =>
  (error instanceof ApiError ? ACCEPT_ERRORS[error.code] : undefined) ?? errorKeyFor(error);

/** A new account chooses its first password here, then goes on through the sign-in steps. */
function ChoosePassword({
  token,
  details,
  onAccepted,
}: {
  token: string;
  details: InviteDetails;
  onAccepted: (next: SignInNext) => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [missing, setMissing] = useState(false);
  const accept = useMutation({
    mutationFn: () =>
      unwrap(
        staffApi().POST('/api/v1/auth/invites/{token}/accept', {
          params: { path: { token } },
          body: { password },
        }),
      ),
    onSuccess: (result) => {
      onAccepted(result.next);
    },
  });
  if (accept.error instanceof ApiError && accept.error.code === 'invalid_link') {
    return <InvalidLink />;
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password === '') {
      setMissing(true);
      return;
    }
    accept.mutate();
  };
  return (
    <AuthCard
      title={t('invite.title', { school: details.school })}
      lede={`${t('invite.for', { email: details.emailMasked })} ${t('invite.choose.lede')}`}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <Input
          label={t('invite.choose.label')}
          type={shown ? 'text' : 'password'}
          name="new-password"
          autoComplete="new-password"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the page exists to take this password
          autoFocus
          value={password}
          error={missing ? t('signIn.password.missing') : fieldError(accept.error, 'password')}
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
          {accept.isError && !isFieldError(accept.error) ? t(acceptErrorKey(accept.error)) : null}
        </StepError>
        <BigButton type="submit" disabled={accept.isPending}>
          {t('invite.choose.submit')}
        </BigButton>
      </form>
    </AuthCard>
  );
}

/**
 * The staff invite page. A new account chooses a password and goes on to two-step and its
 * school. An existing account signs in first, with the invitation's token as a hint so the
 * invited school counts, and accepts once signed in (spec 05: an invite never makes a second
 * account or asks an existing one for a new password).
 */
export function InviteFlow({ token }: { token: string }) {
  const { t } = useTranslation();
  const [flow, setFlow] = useState<SignInState | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const details = useQuery({
    queryKey: ['auth', 'invite', token],
    queryFn: () =>
      unwrap(staffApi().GET('/api/v1/auth/invites/{token}', { params: { path: { token } } })),
    retry: false,
  });

  // The invitation is single use: once accepted, a later answer (after two-step set-up for the
  // chosen school, say) passes straight through instead of accepting again.
  const accepted = useRef(false);
  const acceptOnceSignedIn = useCallback(
    async (next: SignInNext): Promise<SignInNext> => {
      if (accepted.current) return next;
      accepted.current = true;
      try {
        const result = await unwrap(
          staffApi().POST('/api/v1/auth/invites/{token}/accept', {
            params: { path: { token } },
            body: {},
          }),
        );
        return result.next;
      } catch (error) {
        accepted.current = false;
        setFailure(error);
        return next;
      }
    },
    [token],
  );

  if (
    (details.error instanceof ApiError && details.error.code === 'invalid_link') ||
    (failure instanceof ApiError && failure.code === 'invalid_link')
  ) {
    return <InvalidLink />;
  }
  if (failure !== null) {
    return (
      <AuthCard title={t('signIn.title')}>
        <StepError>{t(acceptErrorKey(failure))}</StepError>
        <BigLink href="/sign-in">{t('signIn.backToSignIn')}</BigLink>
      </AuthCard>
    );
  }
  if (details.isPending) return <AuthCard title={t('invite.loading')} />;
  if (details.isError) {
    return (
      <AuthCard title={t('invite.loading')}>
        <StepError>{t(errorKeyFor(details.error))}</StepError>
      </AuthCard>
    );
  }

  const invite = details.data;
  if (flow !== null) {
    return (
      <SignInFlow
        lastSchool={null}
        next="/app"
        initial={flow}
        inviteToken={token}
        beforeSchool={invite.needsPassword ? undefined : acceptOnceSignedIn}
        emailTitle={t('invite.title', { school: invite.school })}
        emailLede={t('invite.existing.lede')}
      />
    );
  }
  if (invite.needsPassword) {
    return (
      <ChoosePassword
        token={token}
        details={invite}
        onAccepted={(next) => {
          setFlow({ step: stepFor(next), email: invite.emailMasked, emailMasked: true });
        }}
      />
    );
  }
  return (
    <AuthCard
      title={t('invite.title', { school: invite.school })}
      lede={`${t('invite.for', { email: invite.emailMasked })} ${t('invite.existing.lede')}`}
    >
      <BigButton
        onClick={() => {
          setFlow(initialSignIn());
        }}
      >
        {t('invite.existing.submit')}
      </BigButton>
    </AuthCard>
  );
}
