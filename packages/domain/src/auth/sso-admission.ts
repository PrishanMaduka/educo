import type { SsoProvider } from '@quad/contracts';

/** One of the account's own staff schools, as SSO sees it. */
export interface SsoSchool {
  readonly ssoDomain: string | null;
  readonly google: boolean;
  readonly microsoft: boolean;
}

/** What the provider vouched for, and the account's own schools. */
export interface SsoAdmissionInput {
  readonly provider: SsoProvider;
  /** The ID token's `email`. */
  readonly email: string;
  /** The ID token's `email_verified`; anything but `true` is not verified. */
  readonly emailVerified: unknown;
  readonly schools: readonly SsoSchool[];
}

export type SsoAdmission = 'admitted' | 'unverified_email' | 'no_school';

/** The part after the last `@`, lower-cased. */
export function emailDomainOf(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

/**
 * Whether an SSO sign-in may continue (spec 05 step 2): the provider verified the email, and one
 * of the account's own staff schools has this provider on with exactly the email's domain as its
 * `sso_domain` (no subdomains). The schools come from the account's memberships, never from the
 * provider, so a domain only ever opens a school the person already belongs to.
 */
export function ssoAdmission(input: SsoAdmissionInput): SsoAdmission {
  if (input.emailVerified !== true) return 'unverified_email';
  const domain = emailDomainOf(input.email);
  const admits = input.schools.some(
    (school) => school[input.provider] && school.ssoDomain?.toLowerCase() === domain,
  );
  return admits ? 'admitted' : 'no_school';
}
