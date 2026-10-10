'use client';

import { Card, SettingRow } from '@quad/ui';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { SchoolSignInRules } from '@quad/contracts';

export interface SignInRulesProps {
  rules: SchoolSignInRules;
}

/** School settings → Sign-in (spec 05 and 08): the school's sign-in rules, read-only. */
export function SignInRules({ rules }: SignInRulesProps) {
  const { t } = useTranslation();
  const rows = [
    [t('schoolSettings.signIn.twoStep'), t(`schoolSettings.signIn.twoStep.${rules.twoStep}`)],
    [
      t('schoolSettings.signIn.password'),
      t('schoolSettings.signIn.passwordValue', { count: rules.passwordMinLength }),
    ],
    [
      t('schoolSettings.signIn.session'),
      t('schoolSettings.signIn.sessionValue', { hours: rules.sessionHours }),
    ],
    [
      t('schoolSettings.signIn.ipAllowlist'),
      rules.ipAllowlist.length === 0
        ? t('schoolSettings.signIn.ipAny')
        : rules.ipAllowlist.join(', '),
    ],
  ] as const;
  return (
    <Card title={t('schoolSettings.signIn.title')} flush className="max-w-[760px]">
      <p className="m-0 flex items-center gap-2 border-b border-line bg-surface-2 px-[18px] py-2.5 text-[13px] text-ink-2">
        <Lock aria-hidden="true" strokeWidth={2} className="size-4 shrink-0" />
        {t('schoolSettings.signIn.managed')}
      </p>
      <dl className="m-0">
        {rows.map(([label, value]) => (
          <SettingRow key={label} label={label}>
            {value}
          </SettingRow>
        ))}
      </dl>
    </Card>
  );
}
