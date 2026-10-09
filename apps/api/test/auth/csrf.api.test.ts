import { randomUUID } from 'node:crypto';

import { Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';

import {
  cookieNames,
  hashSessionToken,
  isSessionTokenShape,
  newSessionToken,
} from '../../src/common/session/cookies';
import { CsrfTokens, needsCsrfToken } from '../../src/common/session/csrf';
import { CLOSED_PORTS, useTestApp } from '../app';
import { productionEnv } from '../env';
import { useDatabaseApp } from '../helpers/database-app';
import { insertSchool, sessionHeaders, signedInMember } from '../helpers/identity';

import { AccessProbeModule } from './probe.module';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const { db, app } = useDatabaseApp({}, { overrides: { testModules: [AccessProbeModule] } });

const patchMe = (headers: Record<string, string>) =>
  app()
    .getHttpAdapter()
    .getInstance()
    .inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: JSON.stringify({ theme: 'dark' }),
    });

describe('double-submit CSRF on cookie-authenticated writes (D32)', () => {
  it('accepts a write that sends the session’s own token in X-CSRF-Token', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    expect((await patchMe(sessionHeaders(session))).statusCode).toBe(200);
  });

  it('refuses a write without the header, with a wrong one, or with another session’s token', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    const other = await signedInMember(db(), school);
    for (const csrf of [undefined, 'not-the-token', other.session.csrf, '']) {
      const headers = sessionHeaders(session, { csrfHeader: false });
      const response = await patchMe(
        csrf === undefined ? headers : { ...headers, 'x-csrf-token': csrf },
      );
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'forbidden' });
    }
  });

  it('does not ask for the token on a read', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    const response = await app()
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: sessionHeaders(session, { csrfHeader: false }),
      });
    expect(response.statusCode).toBe(200);
  });
});

describe('text/plain bodies (D28 follow-up)', () => {
  it('are refused with 415 before the session is even read', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    const response = await app()
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'PATCH',
        url: '/api/v1/me',
        headers: { ...sessionHeaders(session), 'content-type': 'text/plain;charset=UTF-8' },
        payload: '{"theme":"dark"}',
      });
    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });

  it('are refused on a public route too, and on a route that does not exist', async () => {
    for (const url of ['/api/v1/probe/cookies', '/api/v1/nowhere']) {
      const response = await app()
        .getHttpAdapter()
        .getInstance()
        .inject({ method: 'POST', url, headers: { 'content-type': 'TEXT/PLAIN' }, payload: 'x' });
      expect(response.statusCode).toBe(415);
    }
  });

  it('still reach POST /webhooks/ses, which SNS sends as text/plain', async () => {
    const response = await app()
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/ses',
        headers: { 'content-type': 'text/plain; charset=UTF-8' },
        payload: '{}',
      });
    // Refused by the webhook's own checks (no topic configured), not by the media type.
    expect(response.statusCode).not.toBe(415);
  });
});

/** The cookies sign-in (Task 7) sets, through the probe route that calls `setSessionCookies`. */
async function cookiesFrom(app: NestFastifyApplication) {
  const response = await app
    .getHttpAdapter()
    .getInstance()
    .inject({ method: 'POST', url: '/api/v1/probe/cookies' });
  expect(response.statusCode).toBe(201);
  return response.headers['set-cookie'];
}

describe('cookie names and attributes (spec 05, ruling F63)', () => {
  const local = useTestApp(CLOSED_PORTS, { overrides: { testModules: [AccessProbeModule] } });
  const staging = useTestApp(
    { ...productionEnv({ APP_ENV: 'staging' }), REDIS_URL },
    { overrides: { testModules: [AccessProbeModule] } },
  );

  it('are quad_sid and quad_csrf without Secure when APP_ENV=local', async () => {
    expect(await cookiesFrom(local())).toEqual([
      'quad_sid=token; Path=/; HttpOnly; SameSite=Lax',
      'quad_csrf=csrf; Path=/; SameSite=Lax',
    ]);
  });

  it('are __Host-quad_sid (HttpOnly) and __Host-quad_csrf (readable), both Secure, elsewhere', async () => {
    expect(await cookiesFrom(staging())).toEqual([
      '__Host-quad_sid=token; Path=/; HttpOnly; Secure; SameSite=Lax',
      '__Host-quad_csrf=csrf; Path=/; Secure; SameSite=Lax',
    ]);
  });

  it('a non-local app reads the session from __Host-quad_sid, and ignores quad_sid', async () => {
    // A staging config refuses the compose database's passwords, so the session is served from
    // the Redis cache entry SessionService would have written (no database is reached).
    const token = newSessionToken();
    const tenantId = randomUUID();
    const userId = randomUUID();
    const redis = new Redis(REDIS_URL);
    try {
      await redis.set(
        `quad:session:${hashSessionToken(token).toString('hex')}`,
        JSON.stringify({
          kind: 'web',
          sessionId: randomUUID(),
          accountId: randomUUID(),
          stage: 'active',
          tenantId,
          userId,
          previewRoleId: null,
          previewSampleUserId: null,
          supportSessionId: null,
          keepSignedIn: false,
          sessionHours: 12,
          lastSeenAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
        'EX',
        30,
      );
    } finally {
      await redis.quit();
    }
    const probe = (cookie: string) =>
      staging()
        .getHttpAdapter()
        .getInstance()
        .inject({ method: 'GET', url: '/api/v1/probe/context', headers: { cookie } });

    const hosted = await probe(`__Host-quad_sid=${token}`);
    expect(hosted.statusCode).toBe(200);
    expect(hosted.json()).toMatchObject({ tenantId, userId, kind: 'web' });
    expect((await probe(`quad_sid=${token}`)).statusCode).toBe(401);
  });

  it('name the console session, its own CSRF cookie and the trusted device too', () => {
    expect(cookieNames('local').consoleSession).toBe('quad_console_sid');
    // Locally both apps share the host `localhost` (cookies ignore the port), so the console's
    // CSRF cookie needs its own name or it would overwrite the staff one (Task 10).
    expect(cookieNames('local').consoleCsrf).toBe('quad_console_csrf');
    expect(cookieNames('local').trustedDevice).toBe('quad_trusted');
    expect(cookieNames('production')).toEqual({
      session: '__Host-quad_sid',
      consoleSession: '__Host-quad_console_sid',
      consoleCsrf: '__Host-quad_console_csrf',
      csrf: '__Host-quad_csrf',
      trustedDevice: '__Host-quad_trusted',
    });
  });
});

describe('session tokens and CSRF values', () => {
  it('a token is 32 random bytes; the database keeps its SHA-256', () => {
    const token = newSessionToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(isSessionTokenShape(token)).toBe(true);
    expect(isSessionTokenShape(`${token}=`)).toBe(false);
    expect(hashSessionToken(token)).toHaveLength(32);
    expect(hashSessionToken(token).equals(hashSessionToken(newSessionToken()))).toBe(false);
  });

  it('a CSRF value is tied to the session and to the secret', () => {
    const hash = hashSessionToken(newSessionToken());
    const tokens = new CsrfTokens('one-secret-one-secret-one-secret');
    expect(tokens.verify(hash, tokens.tokenFor(hash))).toBe(true);
    expect(tokens.verify(hashSessionToken(newSessionToken()), tokens.tokenFor(hash))).toBe(false);
    expect(
      new CsrfTokens('another-secret-another-secret!!').verify(hash, tokens.tokenFor(hash)),
    ).toBe(false);
    expect(tokens.verify(hash, undefined)).toBe(false);
  });

  it('only writes need it', () => {
    expect(['GET', 'HEAD', 'OPTIONS'].map(needsCsrfToken)).toEqual([false, false, false]);
    expect(['POST', 'PATCH', 'PUT', 'DELETE'].map(needsCsrfToken)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });
});
