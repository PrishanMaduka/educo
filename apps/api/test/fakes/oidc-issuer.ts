import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import Fastify from 'fastify';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

import type { FastifyInstance } from 'fastify';
import type { JWK } from 'jose';

/**
 * A fake OpenID Connect issuer for the API tests and, through `scripts/fake-oidc.mjs`, for
 * Playwright and the e2e stack (D32): discovery, JWKS, authorize and token, with ID tokens signed
 * by a fresh RS256 key. It never asks anything: `/authorize` signs in at once as the queued
 * person, or else as the `login_hint` with a verified email, and redirects back with a code. The
 * token endpoint checks the client, the redirect URI and the PKCE verifier (S256) like a real
 * provider, so a missing or wrong verifier fails. Local and test use only.
 */

/** Who the next `/authorize` signs in as; each field falls back to the `login_hint`. */
export interface FakeSignIn {
  readonly sub?: string;
  readonly email?: string;
  readonly emailVerified?: boolean;
  /** Put this nonce in the ID token instead of the one the client sent. */
  readonly nonce?: string;
  /** Google's Workspace domain claim. */
  readonly hd?: string;
}

export interface FakeOidcIssuer {
  /** The issuer URL (`OIDC_FAKE_ISSUER_URL`), without a trailing slash. */
  readonly url: string;
  /** Queues who the next `/authorize` signs in as. */
  nextSignIn(signIn: FakeSignIn): void;
  /** How many codes the token endpoint has exchanged. */
  readonly exchanged: number;
  close(): Promise<void>;
}

/** The stable subject the fake gives an email when no `sub` is queued. */
export function fakeSubjectFor(email: string): string {
  return `fake-${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 24)}`;
}

interface IssuedCode {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly challenge: string;
  readonly nonce: string;
  readonly claims: Required<Pick<FakeSignIn, 'sub' | 'email' | 'emailVerified'>> & FakeSignIn;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/** Fastify does not parse forms itself; the token endpoint takes `x-www-form-urlencoded`. */
function acceptForms(server: FastifyInstance): void {
  server.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(String(body))));
    },
  );
}

/** The client of a token request: HTTP Basic (client_secret_basic) or the form (…_post). */
function clientIdOf(authorization: string | undefined, form: Record<string, unknown>) {
  if (authorization?.startsWith('Basic ') === true) {
    const decoded = Buffer.from(authorization.slice('Basic '.length), 'base64').toString('utf8');
    return decodeURIComponent(decoded.slice(0, decoded.indexOf(':')));
  }
  return text(form.client_id);
}

export async function startFakeOidcIssuer(
  options: { readonly port?: number; readonly host?: string } = {},
): Promise<FakeOidcIssuer> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const kid = randomBytes(8).toString('hex');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  const queue: FakeSignIn[] = [];
  const codes = new Map<string, IssuedCode>();
  let exchanged = 0;
  let url = '';

  const server = Fastify();
  acceptForms(server);

  server.get('/.well-known/openid-configuration', () => ({
    issuer: url,
    authorization_endpoint: `${url}/authorize`,
    token_endpoint: `${url}/token`,
    jwks_uri: `${url}/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    scopes_supported: ['openid', 'email', 'profile'],
    claims_supported: ['sub', 'email', 'email_verified', 'hd', 'nonce'],
  }));

  server.get('/jwks', () => ({ keys: [jwk] }));

  server.get('/authorize', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const clientId = text(query.client_id);
    const redirectUri = text(query.redirect_uri);
    const state = text(query.state);
    const nonce = text(query.nonce);
    const challenge = text(query.code_challenge);
    if (
      clientId === undefined ||
      redirectUri === undefined ||
      state === undefined ||
      nonce === undefined ||
      challenge === undefined ||
      query.response_type !== 'code' ||
      query.code_challenge_method !== 'S256' ||
      text(query.scope)?.split(' ').includes('openid') !== true
    ) {
      return reply.code(400).send({ error: 'invalid_request' });
    }
    const queued = queue.shift() ?? {};
    const email = queued.email ?? text(query.login_hint);
    if (email === undefined) return reply.code(400).send({ error: 'login_required' });
    const code = randomBytes(24).toString('base64url');
    codes.set(code, {
      clientId,
      redirectUri,
      challenge,
      nonce,
      claims: {
        ...queued,
        email,
        sub: queued.sub ?? fakeSubjectFor(email),
        emailVerified: queued.emailVerified ?? true,
      },
    });
    const back = new URL(redirectUri);
    back.searchParams.set('code', code);
    back.searchParams.set('state', state);
    return reply.redirect(back.href, 302);
  });

  server.post('/token', async (request, reply) => {
    const form = (request.body ?? {}) as Record<string, unknown>;
    const code = text(form.code);
    const issued = code === undefined ? undefined : codes.get(code);
    if (code !== undefined) codes.delete(code);
    const verifier = text(form.code_verifier);
    const challenge =
      verifier === undefined
        ? undefined
        : createHash('sha256').update(verifier).digest('base64url');
    if (
      form.grant_type !== 'authorization_code' ||
      issued === undefined ||
      text(form.redirect_uri) !== issued.redirectUri ||
      clientIdOf(request.headers.authorization, form) !== issued.clientId ||
      challenge !== issued.challenge
    ) {
      return reply.code(400).send({ error: 'invalid_grant' });
    }
    exchanged += 1;
    const { claims } = issued;
    const idToken = await new SignJWT({
      email: claims.email,
      email_verified: claims.emailVerified,
      nonce: claims.nonce ?? issued.nonce,
      ...(claims.hd === undefined ? {} : { hd: claims.hd }),
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(url)
      .setAudience(issued.clientId)
      .setSubject(claims.sub)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    return reply.header('cache-control', 'no-store').send({
      access_token: randomBytes(24).toString('base64url'),
      token_type: 'Bearer',
      expires_in: 300,
      id_token: idToken,
    });
  });

  const address = await server.listen({
    port: options.port ?? 0,
    host: options.host ?? '127.0.0.1',
  });
  url = address.replace(/\/$/, '');
  return {
    url,
    nextSignIn: (signIn) => {
      queue.push(signIn);
    },
    get exchanged() {
      return exchanged;
    },
    close: () => server.close(),
  };
}

/** `tsx test/fakes/oidc-issuer.ts --port 4455` (what `scripts/fake-oidc.mjs` runs). */
async function main(argv: readonly string[]): Promise<void> {
  const index = argv.indexOf('--port');
  const port = index === -1 ? 4455 : Number(argv[index + 1]);
  const issuer = await startFakeOidcIssuer({ port });
  process.stdout.write(`Fake OIDC issuer listening on ${issuer.url}\n`);
  const stop = () => {
    void issuer.close().then(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  void main(process.argv.slice(2));
}
