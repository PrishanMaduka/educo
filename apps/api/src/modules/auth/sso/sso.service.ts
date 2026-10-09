import { Inject, Injectable } from '@nestjs/common';
import { SignInEmail } from '@quad/contracts';
import { emailDomainOf, ssoAdmission } from '@quad/domain';
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from 'openid-client';

import { formatMessage } from '../../../common/delivery/templates/render';
import { AccountLockedError, ForbiddenError, UnauthorizedError } from '../../../common/errors';
import { CLOCK, CONFIG, LOGGER, TENANT_DB } from '../../../tokens';
import { AuthRepository } from '../auth.repository';
import { LockoutService } from '../lockout.service';
import { MembershipsService } from '../memberships.service';
import { SignInService } from '../sign-in.service';

import { OidcClients } from './oidc-clients';
import { SsoStateCookies, sameState } from './sso-state';

import type { SignInClient, SignInOutcome } from '../sign-in.service';
import type { SsoState } from './sso-state';
import type { Config } from '../../../config';
import type { Clock } from '../../../tokens';
import type { SsoCallbackQuery, SsoProvider, SsoStartInput } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';
import type { Logger } from 'pino';

/** What the ID token says about the person, once openid-client has verified it. */
interface ProviderIdentity {
  readonly subject: string;
  readonly email: string;
  readonly emailVerified: unknown;
}

const SCOPE = 'openid email profile';

/**
 * Staff single sign-on (spec 05 step 2; Task 8): the OIDC authorization code flow with PKCE
 * (S256), state and nonce, through `openid-client`. Tenant-less (D16, ruling F14): the provider
 * only vouches for an email; the school comes from the account's own staff memberships, and the
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
    private readonly clients: OidcClients,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CLOCK) private readonly now: Clock,
    @Inject(LOGGER) private readonly logger: Logger,
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
   * `GET /auth/sso/:provider/callback`. In order: the state cookie (signed, unexpired, for this
   * provider, with the same `state`), then openid-client exchanges the code with the PKCE
   * verifier and checks the ID token (signature, issuer, audience, expiry, nonce). Any failure
   * there is 401. Then the account: found by the provider's email, active, and admitted by
   * `ssoAdmission` against its own staff schools; the identity is linked on first use (or
   * reused). Any refusal there is 403, audited for a known account. Only then does a session
   * start, at the step `continueSignIn` decides.
   */
  async callback(
    provider: SsoProvider,
    query: SsoCallbackQuery,
    search: string,
    stateCookie: string | undefined,
    client: SignInClient,
  ): Promise<SignInOutcome> {
    const now = new Date(this.now());
    const saved = this.stateCookies.open(stateCookie, now);
    if (saved === null || saved.provider !== provider || !sameState(saved.state, query.state)) {
      throw new UnauthorizedError(formatMessage('error.ssoUnfinished'));
    }
    const identity = await this.verifiedIdentity(provider, saved, search);
    const email = SignInEmail.safeParse(identity.email);
    const account = email.success
      ? await this.db.definers.accountByIdentifier({ email: email.data })
      : null;
    if (!email.success || account === null || account.status === 'disabled') {
      throw new ForbiddenError('forbidden', formatMessage('error.ssoRefused'));
    }
    if (account.status === 'locked' || this.lockout.isLocked(account, now)) {
      throw new AccountLockedError();
    }
    const admission = ssoAdmission({
      provider,
      email: email.data,
      emailVerified: identity.emailVerified,
      schools: await this.staffSchoolsSso(account.id),
    });
    if (
      admission !== 'admitted' ||
      (await this.repository.linkIdentity(account.id, provider, identity.subject, email.data)) ===
        'conflict'
    ) {
      this.signIn.auditFailureLater(account.id, client, 'sso_refused');
      throw new ForbiddenError('forbidden', formatMessage('error.ssoRefused'));
    }
    return this.signIn.continueSignIn({
      accountId: account.id,
      session: null,
      keepSignedIn: saved.keepSignedIn,
      twoStepDone: false,
      trustedByCookie: await this.signIn.trustedByCookie(account.id, client.trustedToken, now),
      client,
      now,
    });
  }

  /** The browser comes back here; registered with each provider (and the same for the fake). */
  private redirectUri(provider: SsoProvider): string {
    return new URL(`/api/v1/auth/sso/${provider}/callback`, this.config.PUBLIC_WEB_URL).href;
  }

  /** Exchanges the code and verifies the ID token; 401 for anything the provider refuses. */
  private async verifiedIdentity(
    provider: SsoProvider,
    saved: SsoState,
    search: string,
  ): Promise<ProviderIdentity> {
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
      if (claims === undefined || typeof claims.email !== 'string') {
        throw new Error('The ID token has no email.');
      }
      return { subject: claims.sub, email: claims.email, emailVerified: claims.email_verified };
    } catch (error) {
      // The reason only: provider errors can quote the code or the token.
      this.logger.warn(
        { metric: 'sso_callback_refused', provider, reason: reasonOf(error) },
        'An SSO callback was refused',
      );
      throw new UnauthorizedError(formatMessage('error.ssoUnfinished'));
    }
  }

  /** The SSO settings of each of the account's own staff schools (never another school's). */
  private async staffSchoolsSso(accountId: string) {
    const memberships = await this.memberships.staffMemberships(accountId);
    const schools = await Promise.all(
      memberships.map((membership) => this.repository.schoolSso(membership.tenantId)),
    );
    return schools.filter((school) => school !== null);
  }
}

function reasonOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return typeof error.code === 'string' ? error.code : 'unknown';
  }
  return error instanceof Error ? error.name : 'unknown';
}
