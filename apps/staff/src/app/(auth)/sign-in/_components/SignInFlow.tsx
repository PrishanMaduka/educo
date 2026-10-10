'use client';

import { useCallback, useReducer, type ReactNode } from 'react';

import { CheckInbox } from './CheckInbox';
import { ChooseSchool } from './ChooseSchool';
import { EmailStep } from './EmailStep';
import { ForgotStep } from './ForgotStep';
import { NoSchool } from './NoSchool';
import { Opening } from './Opening';
import { PasswordStep } from './PasswordStep';
import { RecoveryCodes } from './RecoveryCodes';
import { initialSignIn, signInReducer, type SignInState } from './sign-in-steps';
import { TwoStepSetup } from './TwoStepSetup';
import { TwoStepStep } from './TwoStepStep';

import type { SignInNotice } from '@/lib/session';
import type { SignInNext } from '@quad/contracts';

export interface SignInFlowProps {
  /** The school remembered on this device, for "Welcome back to {school}". */
  lastSchool: string | null;
  /** Where to go once signed in (already checked by `safeNext`). */
  next: string;
  /** Why the person was sent here, shown above the email step (`signInNoticeFrom`). */
  notice?: SignInNotice | null;
  /** A step to start at other than the work email (the invite page). */
  initial?: SignInState;
  /** A staff invite link's token, sent with each sign-in step as a hint (Task 13). */
  inviteToken?: string;
  /**
   * Runs before the flow follows an answer that signs the person in (choose a school, or open
   * the one school): the invite page accepts its invitation there, and returns the next step.
   */
  beforeSchool?: (next: SignInNext) => Promise<SignInNext>;
  /** Replaces the email step's title and lede (the invite page). */
  emailTitle?: string;
  emailLede?: string;
  /** Replaces the email step's line for parents (the landing page's sign-in dialog). */
  emailParents?: ReactNode;
  /** Opens the portal; a full page load by default, so it starts with the school's branding. */
  onOpen?: (path: string) => void;
}

const openPage = (path: string) => {
  window.location.assign(path);
};

/**
 * The identifier-first staff sign-in (spec 05; `design/admin.html` `authRender`): one card per
 * step, each step's answer from the API deciding the next one.
 */
export function SignInFlow({
  lastSchool,
  next,
  notice = null,
  initial,
  inviteToken,
  beforeSchool,
  emailTitle,
  emailLede,
  emailParents,
  onOpen = openPage,
}: SignInFlowProps) {
  const [state, dispatch] = useReducer(signInReducer, initial ?? initialSignIn());
  const { step, email } = state;

  const answered = useCallback(
    (answer: SignInNext) => {
      if (beforeSchool !== undefined && (answer === 'choose_school' || answer === 'done')) {
        void beforeSchool(answer).then((after) => {
          dispatch({ type: 'answered', next: after });
        });
        return;
      }
      dispatch({ type: 'answered', next: answer });
    },
    [beforeSchool],
  );
  const changeEmail = () => {
    dispatch({ type: 'change_email' });
  };
  const back = () => {
    dispatch({ type: 'back' });
  };

  switch (step.name) {
    case 'email':
      return (
        <EmailStep
          email={email}
          lastSchool={lastSchool}
          notice={notice}
          title={emailTitle}
          lede={emailLede}
          parents={emailParents}
          onSubmit={(address) => {
            dispatch({ type: 'email_entered', email: address });
          }}
        />
      );
    case 'password':
      return (
        <PasswordStep
          email={email}
          inviteToken={inviteToken}
          onAnswer={answered}
          onChangeEmail={changeEmail}
          onForgot={() => {
            dispatch({ type: 'forgot' });
          }}
        />
      );
    case 'two_step':
      return (
        <TwoStepStep
          email={email}
          inviteToken={inviteToken}
          onAnswer={answered}
          onChangeEmail={changeEmail}
        />
      );
    case 'two_step_setup':
      return (
        <TwoStepSetup
          inviteToken={inviteToken}
          onSetUp={(codes, after) => {
            dispatch({ type: 'two_step_set_up', codes, next: after });
          }}
        />
      );
    case 'recovery_codes':
      return (
        <RecoveryCodes
          codes={step.codes}
          onContinue={() => {
            answered(step.then);
          }}
        />
      );
    case 'choose_school':
      return (
        <ChooseSchool
          email={email}
          onOpened={(school) => {
            dispatch({ type: 'school_chosen', school });
          }}
          onTwoStepRequired={() => {
            dispatch({ type: 'two_step_required' });
          }}
        />
      );
    case 'no_school':
      return <NoSchool onBack={back} />;
    case 'forgot':
      return (
        <ForgotStep
          email={email}
          onBack={back}
          onSent={(address) => {
            dispatch({ type: 'reset_sent', email: address });
          }}
        />
      );
    case 'check_inbox':
      return <CheckInbox email={email} onBack={back} />;
    case 'opening':
      return <Opening school={step.school} next={next} onOpen={onOpen} />;
    default: {
      const unknown: never = step;
      throw new Error(`Unknown sign-in step ${JSON.stringify(unknown)}`);
    }
  }
}
