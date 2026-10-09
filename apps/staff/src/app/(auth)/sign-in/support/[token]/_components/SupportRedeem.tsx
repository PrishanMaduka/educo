'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '../../../_components/AuthCard';
import { StepError } from '../../../_components/bits';
import { InvalidLink } from '../../../_components/InvalidLink';

import { ApiError, staffApi, unwrap } from '@/lib/api';
import { errorKeyFor } from '@/lib/error-copy';

/**
 * Redeems the support link once the page has loaded (a link preview that fetches the page
 * without running it uses nothing up), then opens the portal. The ref keeps React's double
 * effects in development from sending the single-use token twice.
 */
export function SupportRedeem({
  token,
  onOpen = (path: string) => {
    window.location.assign(path);
  },
}: {
  token: string;
  onOpen?: (path: string) => void;
}) {
  const { t } = useTranslation();
  const sent = useRef(false);
  const redeem = useMutation({
    mutationFn: () => unwrap(staffApi().POST('/api/v1/auth/support-session', { body: { token } })),
    onSuccess: () => {
      onOpen('/app');
    },
  });
  const { mutate } = redeem;

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    mutate();
  }, [mutate]);

  if (redeem.error instanceof ApiError && redeem.error.code === 'invalid_link') {
    return <InvalidLink />;
  }
  return (
    <AuthCard title={t('support.opening.title')} lede={t('support.opening.lede')}>
      <StepError>{redeem.isError ? t(errorKeyFor(redeem.error)) : null}</StepError>
    </AuthCard>
  );
}
