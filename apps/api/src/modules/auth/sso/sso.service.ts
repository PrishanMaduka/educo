import { Inject, Injectable } from '@nestjs/common';
import { SignInEmail, SsoCallbackQuery, SsoProviderParams } from '@quad/contracts';
import { emailDomainOf, providerVouchesForEmail, ssoAdmits } from '@quad/domain';
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from 'openid-client';

import { formatMessage } from '../../../common/delivery/templates/render';
import { AppError, ForbiddenError } from '../../../common/errors';
import { errorForLog } from '../../../observability/logger';
import { CLOCK, CONFIG, ERROR_REPORTER, LOGGER, TENANT_DB } from '../../../tokens';
import { AccountAudit } from '../account-audit.service';
import { AuthRepository } from '../auth.repository';
import { LockoutService } from '../lockout.service';
import { MembershipsService } from '../memberships.service';
import { SignInService } from '../sign-in.service';

import { OidcClients } from './oidc-clients';
import { SsoStateCookies, sameState } from './sso-state';

import type { SchoolSso } from '../auth.repository';
import type { SignInClient, SignInOutcome } from '../sign-in.service';
import type { OpenedSsoState, SsoState } from './sso-state';
import type { Config } from '../../../config';
import type { ErrorReporter } from '../../../observability/sentry';
import type { Clock } from '../../../tokens';
import type { SsoProvider, SsoSignInError, SsoStartInput } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';
import type { SsoClaims } from '@quad/domain';
import type { Logger } from 'pino';

/** Only what sign-in reads: the subject and the email claims (M-6). */
const SCOPE = 'openid email';
/** `consume_signed_token` purpose for the state cookie's `jti` (single use, D32). */
const STATE_PURPOSE = 'sso_state';

/** A refusal the callback turns into `/sign-in?error=<code>`. */
class SsoRefusal extends Error {
  constructor(readonly code: SsoSignInError) {
    super(`The SSO sign-in was refused (${code}).`);
    this.name = 'SsoRefusal';
  }
}

/** What the callback did: signed in at a step, or why it sends the browser back. */
export type SsoCallbackResult =
  { readonly signedIn: SignInOutcome } | { readonly refused: SsoSignInError };

/** The callback request as the controller sees it; nothing here is trusted yet. */
export interface SsoCallbackRequest {
  readonly params: unknown;
  readonly query: unknown;
  /** The raw query string with its `?` (the OIDC client reads it whole). */
  readonly search: string;
  readonly stateCookie: string | undefined;
  readonly client: SignInClient;
}

/**
 * Staff single sign-on (spec 05 step 2; Task 8): the OIDC authorization code flow with PKCE
 * (S256), state and nonce, through `openid-client`, which also checks the ID token's signature
 * against the issuer's JWKS (`OidcClients`). Tenant-less (D16, ruling F14): the provider only
 * vouches for an email; the school comes from the account's own staff memberships, and the
 * sign-in then continues exactly like the password step (`continueSignIn`), so two-step and
 * Choose a school still apply.
 */
@Injectable()
export class SsoService {
  private readonly stateCookies: SsoStateCookies;

  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: AuthRepository,
    private readonly memberships: MembershipsService,
    private readonly lockout: LockoutService,
    private readonly signIn: SignInService,
    private readonly accountAudit: AccountAudit,
    private readonly clients: OidcClients,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CLOCK) private readonly now: Clock,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(ERROR_REPORTER) private readonly reporter: ErrorReporter,
  ) {
    this.stateCookies = new SsoStateCookies(config.SESSION_SECRET);
  }

  /**
   * `POST /auth/sso/:provider/start`: the provider's sign-in URL and the signed state cookie.
   * Refused (403) when no school at the email's domain has this provider on: the same fact
   * `POST /auth/identify` already shows, and nothing about the account.
   */
  async start(
    provider: SsoProvider,
    input: SsoStartInput,
  ): Promise<{ readonly url: string; readonly cookie: string }> {
    const offered = await this.db.definers.ssoMethodsForDomain(emailDomainOf(input.email));
    if (!offered[provider]) {
      throw new ForbiddenError('forbidden', formatMessage('error.ssoNotOffered'));
    }
    const configuration = await this.clients.configuration(provider);
    const state: SsoState = {
      provider,
      state: randomState(),
      nonce: randomNonce(),
      verifier: randomPKCECodeVerifier(),
      keepSignedIn: input.keepSignedIn,
    };
    const url = buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri(provider),
      scope: SCOPE,
      state: state.state,
      nonce: state.nonce,
      code_challenge: await calculatePKCECodeChallenge(state.verifier),
      code_challenge_method: 'S256',
      login_hint: input.email,
    });
    return { url: url.href, cookie: this.stateCookies.seal(state, new Date(this.now())) };
  }

  /**
   * `GET /auth/sso/:provider/callback`. Every outcome is a redirect (I-5): signed in at the next
   * step, or sent back with an `SsoSignInError`. An unexpected failure is sent back as
   * `sso_unfinished` too, never as a JSON page: it is logged at error level (`sso_callback_failed`)
   * and reported like any 500, so an outage is not hidden. Nothing logged names the query.
   */
  async callback(request: SsoCallbackRequest): Promise<SsoCallbackResult> {
    try {
      return { signedIn: await this.signInWith(request) };
    } catch (error) {
      const refused = refusalOf(error);
      if (refused !== null) {
        this.logger.info({ metric: 'sso_callback_refused', refused }, 'An SSO sign-in was refused');
        return { refused };
      }
      this.logger.error(
        { metric: 'sso_callback_failed', error: errorForLog(error) },
        'An SSO callback failed with an unexpected error',
      );
      this.reporter.capture(error);
      return { refused: 'sso_unfinished' };
    }
  }

  /**
   * In order (each step refuses before the next one runs):
   * 1. the request: a provider we know, and `code` and `state` (or the provider's `error`:
   *    cancelled);
   * 2. the state cookie: signed, unexpired, this provider, the same `state`, used once (`jti`);
   * 3. `openid-client`: the code exchange with the PKCE verifier, and the ID token (signature
   *    against the JWKS, issuer, audience, expiry, nonce);
   * 4. the provider vouches for the email (`providerVouchesForEmail`), decided on the claims
   *    alone, before any account is looked up or audited (I-4);
   * 5. the account by that email: active (a locked one is told so);
   * 6. `ssoAdmits` against the account's own staff schools (Google's `hd` included), then the
   *    identity is linked on first use or reused; refusals here are audited;
   * 7. `continueSignIn`, and earlier password failures are forgotten unless two-step is next.
   */
  private async signInWith(request: SsoCallbackRequest): Promise<SignInOutcome> {
    const params = SsoProviderParams.safeParse(request.params);
    const query = SsoCallbackQuery.safeParse(request.query);
    if (!params.success || !query.success) throw new SsoRefusal('sso_unfinished');
    if (query.data.error !== undefined) throw new SsoRefusal('sso_cancelled');
    const { provider } = params.data;
    const now = new Date(this.now());
    const saved = await this.usedOnce(this.stateCookies.open(request.stateCookie, now), provider, {
      state: query.data.state ?? '',
    });

    const claims = await this.verifiedClaims(provider, saved, request.search);
    const email = SignInEmail.safeParse(claims.email);
    if (!email.success || !providerVouchesForEmail(provider, claims)) {
      throw new SsoRefusal('sso_refused');
    }

    const account = await this.db.definers.accountByIdentifier({ email: email.data });
    if (account === null || account.status === 'disabled') throw new SsoRefusal('sso_refused');
    if (account.status === 'locked' || this.lockout.isLocked(account, now)) {
      throw new SsoRefusal('account_locked');
    }
    const admitted = ssoAdmits({
      provider,
      email: email.data,
      hd: claims.hd,
      schools: await this.staffSchoolsSso(account.id),
    });
    const link = admitted
      ? await this.repository.linkIdentity(account.id, provider, claims.sub, email.data)
      : null;
    if (link === null || link === 'conflict') {
      this.signIn.auditFailureLater(account.id, request.client, 'sso_refused');
      throw new SsoRefusal('sso_refused');
    }
    if (link === 'linked') await this.auditLink(account.id, request.client, provider);

    const outcome = await this.signIn.continueSignIn({
      accountId: account.id,
      session: null,
      keepSignedIn: saved.keepSignedIn,
      method: `sso:${provider}`,
      twoStepDone: false,
      trustedByCookie: await this.signIn.trustedByCookie(
        account.id,
        request.client.trustedToken,
        now,
      ),
      client: request.client,
      now,
    });
    // As after a password: failures are forgotten once every factor has passed.
    if (outcome.next !== 'two_step') await this.lockout.clear(account.id);
    return outcome;
  }

  /** The browser comes back here; registered with each provider (and the same for the fake). */
  private redirectUri(provider: SsoProvider): string {
    return new URL(`/api/v1/auth/sso/${provider}/callback`, this.config.PUBLIC_WEB_URL).href;
  }

  /** The cookie's state, for this provider and this `state`, recorded so it works only once. */
  private async usedOnce(
    saved: OpenedSsoState | null,
    provider: SsoProvider,
    returned: { readonly state: string },
  ): Promise<OpenedSsoState> {
    if (saved === null || saved.provider !== provider || !sameState(saved.state, returned.state)) {
      throw new SsoRefusal('sso_unfinished');
    }
    const first = await this.db.definers.consumeSignedToken({
      nonce: saved.jti,
      purpose: STATE_PURPOSE,
      expiresAt: saved.expiresAt,
    });
    if (!first) throw new SsoRefusal('sso_unfinished');
    return saved;
  }

  /** Exchanges the code and verifies the ID token; `sso_unfinished` for anything refused. */
  private async verifiedClaims(
    provider: SsoProvider,
    saved: SsoState,
    search: string,
  ): Promise<SsoClaims & { readonly sub: string }> {
    const configuration = await this.clients.configuration(provider);
    const currentUrl = new URL(this.redirectUri(provider));
    currentUrl.search = search;
    try {
      const tokens = await authorizationCodeGrant(configuration, currentUrl, {
        pkceCodeVerifier: saved.verifier,
        expectedState: saved.state,
        expectedNonce: saved.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (claims === undefined) throw new Error('The token response has no ID token.');
      return claims;
    } catch (error) {
      // The reason only: provider errors can quote the code or the token.
      this.logger.warn(
        { metric: 'sso_token_refused', provider, reason: reasonOf(error) },
        'An SSO code exchange or ID token was refused',
      );
      throw new SsoRefusal('sso_unfinished');
    }
  }

  /** The SSO settings of each of the account's own staff schools (never another school's). */
  private async staffSchoolsSso(accountId: string): Promise<SchoolSso[]> {
    const memberships = await this.memberships.staffMemberships(accountId);
    const schools = await Promise.all(
      memberships.map((membership) => this.repository.schoolSso(membership.tenantId)),
    );
    return schools.filter((school) => school !== null);
  }

  /** `auth.sso_linked` in the account's staff schools; a failed audit never fails the sign-in. */
  private async auditLink(
    accountId: string,
    client: SignInClient,
    provider: SsoProvider,
  ): Promise<void> {
    try {
      await this.accountAudit.recordInStaffSchools(accountId, client.ip, 'auth.sso_linked', {
        provider,
      });
    } catch (error) {
      this.logger.warn(
        { metric: 'sso_link_audit_failed', error: errorForLog(error) },
        'A new SSO link could not be audited',
      );
    }
  }
}

/** The `SsoSignInError` for an expected refusal, or null for an unexpected error. */
function refusalOf(error: unknown): SsoSignInError | null {
  if (error instanceof SsoRefusal) return error.code;
  if (!(error instanceof AppError)) return null;
  // From the shared sign-in steps: a provider that cannot be reached (503), a session or account
  // that changed under the sign-in (401), a school that cannot be opened (403).
  if (error.code === 'account_locked') return 'account_locked';
  if (error.status === 401 || error.status === 503) return 'sso_unfinished';
  if (error.status === 403) return 'sso_refused';
  return null;
}

function reasonOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return typeof error.code === 'string' ? error.code : 'unknown';
  }
  return error instanceof Error ? error.name : 'unknown';
}
