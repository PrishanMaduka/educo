import type { SsoProvider } from '@quad/contracts';

/** One of the account's own staff schools, as SSO sees it. */
export interface SsoSchool {
  readonly ssoDomain: string | null;
  readonly google: boolean;
  readonly microsoft: boolean;
}

/** The verified ID token claims SSO reads; anything a provider did not send is undefined. */
export interface SsoClaims {
  readonly email?: unknown;
  /** Google: the email is verified. Ignored for Microsoft, which never sends it (nOAuth). */
  readonly email_verified?: unknown;
  /** Entra: "email domain owner verified" (an optional claim the app registration adds). */
  readonly xms_edov?: unknown;
  /** Google: the Workspace domain of the account; absent for a consumer Google account. */
  readonly hd?: unknown;
}

/** The provider has vouched for `email`; the schools are the account's own staff schools. */
export interface SsoAdmissionInput {
  readonly provider: SsoProvider;
  readonly email: string;
  /** Google's `hd` claim, as sent. */
  readonly hd: unknown;
  readonly schools: readonly SsoSchool[];
}

/** The part after the last `@`, lower-cased. */
export function emailDomainOf(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

/**
 * Whether the provider vouches that the ID token's email belongs to the person (spec 05 step 2,
 * D32). Google: `email_verified` is `true` and the account is in the email's own Workspace (`hd`
 * equals the email's domain, any case), so a consumer Google account holding a work address is
 * refused here, before any account lookup. Microsoft: only `xms_edov` is `true`; `email` in an
 * Entra token is whatever the user's own tenant set, and `email_verified` is never sent, so
 * trusting either would let any Entra tenant claim any address (nOAuth). Decided before any
 * account is looked up.
 */
export function providerVouchesForEmail(provider: SsoProvider, claims: SsoClaims): boolean {
  if (typeof claims.email !== 'string' || claims.email === '') return false;
  switch (provider) {
    case 'google':
      return (
        claims.email_verified === true &&
        typeof claims.hd === 'string' &&
        claims.hd.toLowerCase() === emailDomainOf(claims.email)
      );
    case 'microsoft':
      return claims.xms_edov === true;
  }
}

/**
 * Whether an SSO sign-in may continue (spec 05 step 2): one of the account's own staff schools
 * has this provider on with exactly the email's domain as its `sso_domain` (no subdomains, any
 * case), and for Google the account's Workspace domain (`hd`) is that same domain, so a consumer
 * Google account holding the work address (or another Workspace) is refused. The schools come
 * from the account's memberships, never from the provider.
 */
export function ssoAdmits(input: SsoAdmissionInput): boolean {
  const domain = emailDomainOf(input.email);
  const workspace = typeof input.hd === 'string' ? input.hd.toLowerCase() : null;
  return input.schools.some(
    (school) =>
      school[input.provider] &&
      school.ssoDomain?.toLowerCase() === domain &&
      (input.provider !== 'google' || workspace === domain),
  );
}
