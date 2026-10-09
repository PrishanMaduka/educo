import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import Fastify from 'fastify';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { JWK } from 'jose';

/**
 * A fake OpenID Connect issuer for the API tests and, through `scripts/fake-oidc.mjs`, for
 * Playwright and the e2e stack (D32). Each client has its own issuer at `<url>/<client>`
 * (`google`, `microsoft`, `console_google`), shaped like the real one:
 * - Google: `email_verified` and the Workspace `hd` (the email's domain unless a test says
 *   otherwise);
 * - Microsoft (Entra): no `email_verified`; `xms_edov` (the optional claim the app registration
 *   adds) and `tid`.
 * Each issuer serves discovery, JWKS, authorize and token, with ID tokens signed by a fresh RS256
 * key. `/authorize` never asks anything: it signs in at once as the queued person, or else as
 * the `login_hint`, and redirects back with a code. The token endpoint checks the client, the
 * redirect URI and the PKCE verifier (S256) like a real provider. Local and test use only.
 */

export type FakeClient = 'google' | 'microsoft' | 'console_google';
const CLIENTS: readonly FakeClient[] = ['google', 'microsoft', 'console_google'];

/** The fake Entra tenant every Microsoft sign-in belongs to unless a test says otherwise. */
export const FAKE_ENTRA_TENANT = '7f3c2a10-5d4e-4b6a-9c8d-0e1f2a3b4c5d';

/**
 * Who the next `/authorize` signs in as, and how the ID token looks. A field left out takes the
 * provider's default; `null` leaves the claim out of the token.
 */
export interface FakeSignIn {
  readonly sub?: string;
  readonly email?: string | null;
  /** Google default `true`; Microsoft default: not sent. */
  readonly emailVerified?: boolean | null;
  /** Google only; default the email's domain. */
  readonly hd?: string | null;
  /** Microsoft only; default `true`. */
  readonly xmsEdov?: boolean | null;
  /** Microsoft only; default `FAKE_ENTRA_TENANT`. */
  readonly tid?: string;
  /** Put this nonce in the ID token instead of the one the client sent. */
  readonly nonce?: string;
  /** Sign the ID token with a key the JWKS does not publish (same `kid`). */
  readonly signWithForeignKey?: boolean;
}

export interface FakeOidcIssuer {
  /** The base URL (`OIDC_FAKE_ISSUER_URL`), without a trailing slash. */
  readonly url: string;
  /** Queues who the next `/authorize` signs in as. */
  nextSignIn(signIn: FakeSignIn): void;
  /** How many codes the token endpoints have exchanged. */
  readonly exchanged: number;
  close(): Promise<void>;
}

/** The stable subject the fake gives an email when no `sub` is queued. */
export function fakeSubjectFor(email: string): string {
  return `fake-${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 24)}`;
}

interface IssuedCode {
  readonly client: FakeClient;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly challenge: string;
  readonly nonce: string;
  readonly sub: string;
  readonly email: string | null;
  readonly signIn: FakeSignIn;
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

/** The provider-shaped claims of an ID token (null fields are left out). */
function claimsOf(issued: IssuedCode): Record<string, unknown> {
  const { signIn, email } = issued;
  const claims: Record<string, unknown> = { nonce: signIn.nonce ?? issued.nonce };
  if (email !== null) claims.email = email;
  const domain = email === null ? null : email.slice(email.lastIndexOf('@') + 1);
  if (issued.client === 'microsoft') {
    if (signIn.emailVerified != null) claims.email_verified = signIn.emailVerified;
    const xmsEdov = signIn.xmsEdov === undefined ? true : signIn.xmsEdov;
    if (xmsEdov !== null) claims.xms_edov = xmsEdov;
    claims.tid = signIn.tid ?? FAKE_ENTRA_TENANT;
  } else {
    const verified = signIn.emailVerified === undefined ? true : signIn.emailVerified;
    if (verified !== null) claims.email_verified = verified;
    const hd = signIn.hd === undefined ? domain : signIn.hd;
    if (hd !== null) claims.hd = hd;
  }
  return claims;
}

export async function startFakeOidcIssuer(
  options: { readonly port?: number; readonly host?: string } = {},
): Promise<FakeOidcIssuer> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const foreign = await generateKeyPair('RS256');
  const kid = randomBytes(8).toString('hex');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  const queue: FakeSignIn[] = [];
  const codes = new Map<string, IssuedCode>();
  let exchanged = 0;
  let url = '';

  const server = Fastify();
  acceptForms(server);
  const clientOf = (request: FastifyRequest): FakeClient | undefined =>
    CLIENTS.find((client) => client === (request.params as { client?: string }).client);
  const notFound = (reply: FastifyReply) => reply.code(404).send({ error: 'not_found' });

  server.get('/:client/.well-known/openid-configuration', (request, reply) => {
    const client = clientOf(request);
    if (client === undefined) return notFound(reply);
    const issuer = `${url}/${client}`;
    return {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      scopes_supported: ['openid', 'email'],
    };
  });

  server.get('/:client/jwks', (request, reply) =>
    clientOf(request) === undefined ? notFound(reply) : { keys: [jwk] },
  );

  server.get('/:client/authorize', async (request, reply) => {
    const client = clientOf(request);
    if (client === undefined) return notFound(reply);
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
    const signIn = queue.shift() ?? {};
    const hint = text(query.login_hint);
    const email = signIn.email === undefined ? (hint ?? null) : signIn.email;
    const person = email ?? hint;
    if (person === undefined) return reply.code(400).send({ error: 'login_required' });
    const sub = signIn.sub ?? fakeSubjectFor(person);
    const code = randomBytes(24).toString('base64url');
    codes.set(code, { client, clientId, redirectUri, challenge, nonce, sub, email, signIn });
    const back = new URL(redirectUri);
    back.searchParams.set('code', code);
    back.searchParams.set('state', state);
    return reply.redirect(back.href, 302);
  });

  server.post('/:client/token', async (request, reply) => {
    const client = clientOf(request);
    if (client === undefined) return notFound(reply);
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
      issued.client !== client ||
      text(form.redirect_uri) !== issued.redirectUri ||
      clientIdOf(request.headers.authorization, form) !== issued.clientId ||
      challenge !== issued.challenge
    ) {
      return reply.code(400).send({ error: 'invalid_grant' });
    }
    exchanged += 1;
    const idToken = await new SignJWT(claimsOf(issued))
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(`${url}/${client}`)
      .setAudience(issued.clientId)
      .setSubject(issued.sub)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(issued.signIn.signWithForeignKey === true ? foreign.privateKey : privateKey);
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
