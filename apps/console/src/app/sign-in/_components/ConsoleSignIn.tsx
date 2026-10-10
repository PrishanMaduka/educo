'use client';

import { AuthCard } from '@quad/ui/auth';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CodeStep } from './CodeStep';
import { CredentialsStep } from './CredentialsStep';

import type { PlatformSignInNext } from '@quad/contracts';

import { openPage } from '@/lib/navigate';

/** The console's sign-in steps (spec 05): the API says which comes after the password. */
type Step = 'credentials' | 'two_step' | 'two_step_setup' | 'opening';

const stepAfter = (next: PlatformSignInNext): Step => (next === 'done' ? 'opening' : next);

/**
 * `/sign-in` on the console (spec 05, D37): Quad email and password, then the authenticator's
 * code, or setting one up on a first sign-in. There is no single sign-on and no recovery code.
 * Once signed in, the page asked for (`next`, already checked) opens as a full load.
 */
export function ConsoleSignIn({ next }: { next: string }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (step === 'opening') openPage(next);
  }, [step, next]);

  const answer = (result: PlatformSignInNext) => {
    setStep(stepAfter(result));
  };

  switch (step) {
    case 'credentials':
      return <CredentialsStep email={email} onEmailChange={setEmail} onAnswer={answer} />;
    case 'two_step':
    case 'two_step_setup':
      return (
        <CodeStep
          setup={step === 'two_step_setup'}
          email={email}
          onAnswer={answer}
          onBack={() => {
            setStep('credentials');
          }}
        />
      );
    case 'opening':
      return <AuthCard title={t('console.signIn.opening')} />;
  }
}
