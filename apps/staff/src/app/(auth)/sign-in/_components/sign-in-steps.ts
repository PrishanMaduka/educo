import type { SignInNext } from '@quad/contracts';

/**
 * The sign-in page's steps (spec 05, identifier first): the work email, then always the password,
 * then whatever the API says comes next. The page never decides the next step itself.
 */
export type SignInStep =
  | { readonly name: 'email' }
  | { readonly name: 'password' }
  | { readonly name: 'two_step' }
  | { readonly name: 'two_step_setup' }
  | {
      readonly name: 'recovery_codes';
      readonly codes: readonly string[];
      readonly then: SignInNext;
    }
  | { readonly name: 'choose_school' }
  | { readonly name: 'no_school' }
  | { readonly name: 'forgot' }
  | { readonly name: 'check_inbox' }
  /** "Opening {school}…" before the portal loads; the name is null until it is known. */
  | { readonly name: 'opening'; readonly school: string | null };

export interface SignInState {
  readonly step: SignInStep;
  /** The work email typed at the first step (shown, and sent with the password). */
  readonly email: string;
  /**
   * True when `email` is the invite's masked address (`n•••@school.lk`): shown on the card only,
   * never put back in the email field.
   */
  readonly emailMasked?: boolean;
}

export type SignInEvent =
  | { readonly type: 'email_entered'; readonly email: string }
  | { readonly type: 'change_email' }
  /** An answer from the password, code or invite step: the API's next step. */
  | { readonly type: 'answered'; readonly next: SignInNext }
  | {
      readonly type: 'two_step_set_up';
      readonly codes: readonly string[];
      /** Null when set-up finished outside a sign-in step: the codes then lead to the portal. */
      readonly next: SignInNext | null;
    }
  /** Choosing a school answered `two_step_required`: that school needs two-step first. */
  | { readonly type: 'two_step_required' }
  | { readonly type: 'school_chosen'; readonly school: string }
  | { readonly type: 'forgot' }
  | { readonly type: 'reset_sent'; readonly email: string }
  | { readonly type: 'back' };

/** The step for the API's next step. */
export function stepFor(next: SignInNext): SignInStep {
  switch (next) {
    case 'two_step':
    case 'two_step_setup':
    case 'choose_school':
    case 'no_school':
      return { name: next };
    case 'done':
      return { name: 'opening', school: null };
    default: {
      const unknown: never = next;
      throw new Error(`Unknown sign-in step ${String(unknown)}`);
    }
  }
}

/** The work email step, or the password step when the address is already known. */
export function initialSignIn(email = ''): SignInState {
  return { step: { name: email === '' ? 'email' : 'password' }, email };
}

export function signInReducer(state: SignInState, event: SignInEvent): SignInState {
  switch (event.type) {
    case 'email_entered':
      return { step: { name: 'password' }, email: event.email };
    case 'change_email':
    case 'back':
      return { step: { name: 'email' }, email: state.emailMasked === true ? '' : state.email };
    case 'answered':
      return { ...state, step: stepFor(event.next) };
    case 'two_step_set_up':
      return {
        ...state,
        step: { name: 'recovery_codes', codes: event.codes, then: event.next ?? 'done' },
      };
    case 'two_step_required':
      return { ...state, step: { name: 'two_step_setup' } };
    case 'school_chosen':
      return { ...state, step: { name: 'opening', school: event.school } };
    case 'forgot':
      return { ...state, step: { name: 'forgot' } };
    case 'reset_sent':
      return { step: { name: 'check_inbox' }, email: event.email };
    default: {
      const unknown: never = event;
      throw new Error(`Unknown sign-in event ${JSON.stringify(unknown)}`);
    }
  }
}
