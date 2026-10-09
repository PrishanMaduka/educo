import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  allowInsecureRequests,
  customFetch,
  discovery,
  enableNonRepudiationChecks,
} from 'openid-client';

import { UnavailableError } from '../../../common/errors';
import { errorForLog } from '../../../observability/logger';
import { CONFIG, LOGGER, OIDC_FETCH } from '../../../tokens';

import type { Config } from '../../../config';
import type { Configuration, CustomFetch } from 'openid-client';
import type { Logger } from 'pino';

/** The OIDC clients the API signs people in with: staff Google and Microsoft, console Google. */
export type OidcClientName = 'google' | 'microsoft' | 'console_google';

/**
 * The real issuers. Microsoft's `organizations` endpoint takes any Entra work account;
 * openid-client checks each ID token's issuer against its own `tid`.
 */
const ISSUERS: Readonly<Record<OidcClientName, string>> = {
  google: 'https://accounts.google.com',
  microsoft: 'https://login.microsoftonline.com/organizations/v2.0',
  console_google: 'https://accounts.google.com',
};

/** How long a call to the provider may take (discovery, then every call of the client). */
const TIMEOUT_SECONDS = 10;

interface ClientCredentials {
  readonly issuer: URL;
  readonly clientId: string;
  readonly clientSecret: string | undefined;
  /** Only the local fake issuer is plain http. */
  readonly fake: boolean;
}

/**
 * The OIDC client configurations (`openid-client`, discovered once per client and kept), each
 * with non-repudiation checks on, so every ID token's signature is verified against the issuer's
 * JWKS. With `OIDC_FAKE_ISSUER_URL` (local only, D32) each client uses the fake issuer at
 * `<url>/<client>`, so nothing ever calls Google or Microsoft from a test or the e2e stack; a
 * client with no id configured then uses `quad-local-<client>`. Without the fake, a client with
 * no id is not available (503).
 */
@Injectable()
export class OidcClients {
  private readonly discovered = new Map<OidcClientName, Promise<Configuration>>();

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(LOGGER) private readonly logger: Logger,
    /** Replaces `fetch` for every call to the provider (unit tests of the real issuers only). */
    @Optional() @Inject(OIDC_FETCH) private readonly fetchOverride?: CustomFetch,
  ) {}

  /** The client's configuration; 503 `unavailable` when it is not set up or cannot be reached. */
  async configuration(name: OidcClientName): Promise<Configuration> {
    const credentials = this.credentials(name);
    if (credentials === null) throw new UnavailableError();
    let pending = this.discovered.get(name);
    if (pending === undefined) {
      pending = discovery(
        credentials.issuer,
        credentials.clientId,
        credentials.clientSecret,
        undefined,
        {
          timeout: TIMEOUT_SECONDS,
          // openid-client marks this deprecated only so it stands out: the local fake issuer is
          // plain http, and OIDC_FAKE_ISSUER_URL is refused outside local (D32).
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          ...(credentials.fake ? { execute: [allowInsecureRequests] } : {}),
          ...(this.fetchOverride === undefined ? {} : { [customFetch]: this.fetchOverride }),
        },
      ).then((configuration) => {
        // Without this, an ID token from the token endpoint is trusted on TLS alone and its JWS
        // signature is never checked against the issuer's JWKS (review I-1, D32).
        enableNonRepudiationChecks(configuration);
        return configuration;
      });
      this.discovered.set(name, pending);
    }
    try {
      return await pending;
    } catch (error) {
      // Try again on the next sign-in rather than keeping the failure.
      this.discovered.delete(name);
      this.logger.warn(
        { metric: 'oidc_discovery_failed', client: name, error: errorForLog(error) },
        'An SSO provider could not be reached',
      );
      throw new UnavailableError();
    }
  }

  private credentials(name: OidcClientName): ClientCredentials | null {
    const [clientId, clientSecret] = this.clientOf(name);
    const fakeIssuer = this.config.OIDC_FAKE_ISSUER_URL;
    if (fakeIssuer !== undefined) {
      return {
        // One fake issuer per client, shaped like its real provider (D32).
        issuer: new URL(name, fakeIssuer.endsWith('/') ? fakeIssuer : `${fakeIssuer}/`),
        clientId: clientId ?? `quad-local-${name}`,
        clientSecret,
        fake: true,
      };
    }
    if (clientId === undefined) return null;
    return { issuer: new URL(ISSUERS[name]), clientId, clientSecret, fake: false };
  }

  private clientOf(name: OidcClientName): readonly [string | undefined, string | undefined] {
    switch (name) {
      case 'google':
        return [this.config.GOOGLE_CLIENT_ID, this.config.GOOGLE_CLIENT_SECRET];
      case 'microsoft':
        return [this.config.MICROSOFT_CLIENT_ID, this.config.MICROSOFT_CLIENT_SECRET];
      case 'console_google':
        return [this.config.CONSOLE_GOOGLE_CLIENT_ID, this.config.CONSOLE_GOOGLE_CLIENT_SECRET];
    }
  }
}
