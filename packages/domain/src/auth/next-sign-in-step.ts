import type { SignInNext } from '@quad/contracts';

/** What the API knows after the password (or SSO) step, before a session is in a school. */
export interface SignInFacts {
  /** The account has a confirmed authenticator. */
  readonly totpEnabled: boolean;
  /** `strictestTwoStep(...).required`: a school's rule covers the person's role there. */
  readonly twoStepRequired: boolean;
  /** The request carried a valid trusted-device cookie of this account (30 days). */
  readonly trustedDevice: boolean;
  /** Active staff memberships of live schools (suspended ones included). */
  readonly membershipCount: number;
}

/**
 * The next sign-in step (spec 05 steps 4 and 5). An authenticator is always asked for unless the
 * device is trusted, and a required one is set up first (a trusted device cannot skip that).
 * Then the schools: none gives `no_school`, one `done`, several `choose_school`. The server never
 * picks a school among several (spec 05): there is no remembered-school input.
 */
export function nextSignInStep(facts: SignInFacts): SignInNext {
  const { membershipCount } = facts;
  if (!Number.isInteger(membershipCount) || membershipCount < 0) {
    throw new RangeError('A membership count must be a whole number, 0 or more.');
  }
  if (facts.totpEnabled && !facts.trustedDevice) return 'two_step';
  if (facts.twoStepRequired && !facts.totpEnabled) return 'two_step_setup';
  if (membershipCount === 0) return 'no_school';
  return membershipCount === 1 ? 'done' : 'choose_school';
}
