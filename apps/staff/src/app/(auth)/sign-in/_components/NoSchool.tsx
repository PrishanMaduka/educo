'use client';

import { useTranslation } from 'react-i18next';

import { AuthCard } from './AuthCard';
import { BigButton } from './bits';

/** No staff membership (spec 05): what to do, from the person's side. */
export function NoSchool({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <AuthCard title={t('signIn.noSchool.title')} lede={t('signIn.noSchool.body')}>
      <BigButton variant="secondary" onClick={onBack}>
        {t('signIn.backToSignIn')}
      </BigButton>
    </AuthCard>
  );
}
