'use client';

import { Button, cn } from '@quad/ui';
import { AuthCard } from '@quad/ui/auth';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BigButton } from './bits';

/** Writes to the clipboard; rejects where there is none (`navigator.clipboard` is secure-context only). */
function copyText(text: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- undefined outside secure contexts
  if (navigator.clipboard === undefined) return Promise.reject(new Error('No clipboard'));
  return navigator.clipboard.writeText(text);
}

/** After set-up (spec 05): the 10 recovery codes, shown once, with Copy. */
export function RecoveryCodes({
  codes,
  onContinue,
}: {
  codes: readonly string[];
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
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
            // The clipboard can be refused (permissions) or missing (an insecure page): say so,
            // so the person copies the codes by hand.
            copyText(codes.join('\n')).then(
              () => {
                setCopy('copied');
              },
              () => {
                setCopy('failed');
              },
            );
          }}
        >
          {t('signIn.codes.copy')}
        </Button>
        <span
          aria-live="polite"
          className={cn('text-[13px] font-semibold', copy === 'failed' ? 'text-bad' : 'text-good')}
        >
          {copy === 'copied'
            ? t('signIn.codes.copied')
            : copy === 'failed'
              ? t('signIn.codes.copyFailed')
              : null}
        </span>
      </div>
      <BigButton onClick={onContinue}>{t('signIn.codes.submit')}</BigButton>
    </AuthCard>
  );
}
