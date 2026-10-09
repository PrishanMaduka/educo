'use client';

import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from './AuthCard';
import { BigButton } from './bits';

/** After Forgot password: the same words whether or not the address has an account. */
export function CheckInbox({ email, onBack }: { email: string; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <AuthCard
      icon={<Mail aria-hidden="true" className="size-[26px]" />}
      title={t('signIn.inbox.title')}
      lede={t('signIn.inbox.body', { email })}
    >
      <BigButton variant="secondary" onClick={onBack}>
        {t('signIn.backToSignIn')}
      </BigButton>
    </AuthCard>
  );
}
