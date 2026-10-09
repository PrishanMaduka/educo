import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { authorizationCodeGrant } from 'openid-client';
import pino from 'pino';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config';
import { OidcClients } from '../../src/modules/auth/sso/oidc-clients';
import { localEnv } from '../env';

import type { CryptoKey, JWK } from 'jose';
import type { CustomFetch } from 'openid-client';

/**
 * The real Microsoft client (no fake issuer), with every HTTP call answered in memory through
 * openid-client's `customFetch` (review M-4). Entra's multi-tenant discovery publishes the issuer
 * `https://login.microsoftonline.com/{tenantid}/v2.0`; openid-client must accept a token only
 * when its `iss` is that template filled with the token's own `tid`, and (I-1) only with a
 * signature from the published keys.
 */

const ENTRA = 'https://login.microsoftonline.com';
const CLIENT_ID = 'entra-client-id';
const TENANT = '2b1d4f6a-8c3e-4a5b-9d7f-1e2c3a4b5c6d';
const VERIFIER = 'v'.repeat(43);
const NONCE = 'the-nonce';

let signing: CryptoKey;
let foreign: CryptoKey;
let jwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  signing = pair.privateKey;
  foreign = (await generateKeyPair('RS256')).privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
});

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

/** An in-memory Entra that issues one ID token with `claims`, signed by `key`. */
function entra(options: { readonly claims: Record<string, unknown>; readonly key?: CryptoKey }) {
  const calls: string[] = [];
  const fetch: CustomFetch = async (url) => {
    calls.push(url);
    if (url === `${ENTRA}/organizations/v2.0/.well-known/openid-configuration`) {
      return json({
        issuer: `${ENTRA}/{tenantid}/v2.0`,
        authorization_endpoint: `${ENTRA}/organizations/oauth2/v2.0/authorize`,
        token_endpoint: `${ENTRA}/organizations/oauth2/v2.0/token`,
        jwks_uri: `${ENTRA}/organizations/discovery/v2.0/keys`,
        response_types_supported: ['code'],
        id_token_signing_alg_values_supported: ['RS256'],
      });
    }
    if (url === `${ENTRA}/organizations/discovery/v2.0/keys`) return json({ keys: [jwk] });
    if (url === `${ENTRA}/organizations/oauth2/v2.0/token`) {
      const idToken = await new SignJWT({ nonce: NONCE, ...options.claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setAudience(CLIENT_ID)
        .setSubject('entra-subject')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(options.key ?? signing);
      return json({ access_token: 'at', token_type: 'Bearer', id_token: idToken });
    }
    return new Response('not found', { status: 404 });
  };
  return { fetch, calls };
}

async function signInAtEntra(provider: ReturnType<typeof entra>) {
  const clients = new OidcClients(
    loadConfig(localEnv({ MICROSOFT_CLIENT_ID: CLIENT_ID, MICROSOFT_CLIENT_SECRET: 'secret' })),
    pino({ level: 'silent' }),
    provider.fetch,
  );
  const configuration = await clients.configuration('microsoft');
  const tokens = await authorizationCodeGrant(
    configuration,
    new URL('https://quad.test/api/v1/auth/sso/microsoft/callback?code=c&state=s'),
    {
      pkceCodeVerifier: VERIFIER,
      expectedState: 's',
      expectedNonce: NONCE,
      idTokenExpected: true,
    },
  );
  return tokens.claims();
}

describe('OidcClients: the real Microsoft (Entra) issuer', () => {
  it('discovers organizations/v2.0 and accepts a token whose iss is the template filled with its tid', async () => {
    const provider = entra({
      claims: { iss: `${ENTRA}/${TENANT}/v2.0`, tid: TENANT, email: 'a@x.test', xms_edov: true },
    });
    await expect(signInAtEntra(provider)).resolves.toMatchObject({
      tid: TENANT,
      xms_edov: true,
    });
    // The signature was checked against the published keys (non-repudiation checks, I-1).
    expect(provider.calls).toContain(`${ENTRA}/organizations/discovery/v2.0/keys`);
  });

  it('refuses a token whose iss names another tenant than its own tid', async () => {
    const provider = entra({
      claims: { iss: `${ENTRA}/${TENANT}/v2.0`, tid: '00000000-0000-4000-8000-000000000000' },
    });
    await expect(signInAtEntra(provider)).rejects.toMatchObject({
      code: 'OAUTH_JWT_CLAIM_COMPARISON_FAILED',
      cause: { message: expect.stringContaining('"iss"') as unknown },
    });
  });

  it('refuses a token signed with a key Entra does not publish', async () => {
    const provider = entra({
      claims: { iss: `${ENTRA}/${TENANT}/v2.0`, tid: TENANT },
      key: foreign,
    });
    await expect(signInAtEntra(provider)).rejects.toMatchObject({
      cause: { message: 'JWT signature verification failed' },
    });
  });
});
