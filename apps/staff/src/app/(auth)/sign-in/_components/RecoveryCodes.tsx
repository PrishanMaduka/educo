'use client';

import { Button } from '@quad/ui';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from './AuthCard';
import { BigButton } from './bits';

/** After set-up (spec 05): the 10 recovery codes, shown once, with Copy. */
export function RecoveryCodes({
  codes,
  onContinue,
}: {
  codes: readonly string[];
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <AuthCard title={t('signIn.codes.title')} lede={t('signIn.codes.lede')}>
      <ol
        aria-label={t('signIn.codes.list')}
        className="m-0 grid list-none grid-cols-2 gap-2 rounded-card border border-line bg-surface-2 p-4"
      >
        {codes.map((code) => (
          <li key={code} className="font-mono text-[14px] font-semibold text-ink">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          icon={Copy}
          onClick={() => {
            void navigator.clipboard.writeText(codes.join('\n')).then(() => {
              setCopied(true);
            });
          }}
        >
          {t('signIn.codes.copy')}
        </Button>
        <span aria-live="polite" className="text-[13px] font-semibold text-good">
          {copied ? t('signIn.codes.copied') : null}
        </span>
      </div>
      <BigButton onClick={onContinue}>{t('signIn.codes.submit')}</BigButton>
    </AuthCard>
  );
}
