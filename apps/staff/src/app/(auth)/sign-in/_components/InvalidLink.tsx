'use client';

import { useTranslation } from 'react-i18next';

import { AuthCard } from './AuthCard';
import { BigLink } from './bits';

/**
 * A signed link the API refused (`invalid_link`: tampered, expired, used, or for another
 * purpose). The same words for every reason, and never the school's name (D16).
 */
export function InvalidLink() {
  const { t } = useTranslation();
  return (
    <AuthCard title={t('link.invalid.title')} lede={t('link.invalid.body')}>
      <BigLink href="/sign-in">{t('signIn.backToSignIn')}</BigLink>
    </AuthCard>
  );
}
