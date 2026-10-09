import {
  createPrivateKey,
  createPublicKey,
  createSecretKey,
  generateKeyPairSync,
  randomUUID,
} from 'node:crypto';

import { TokenPair } from '@quad/contracts';
import { SignJWT, calculateJwkThumbprint, decodeProtectedHeader, exportJWK } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';

import { SessionService } from '../../src/common/session/session.service';
import { API_ROUTES } from '../../src/openapi/document';
import { TEST_JWT_KEYS } from '../env';
import { RecordingDelivery } from '../fakes/delivery';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertSchool } from '../helpers/identity';
import {
  bearer,
  claimsOf,
  familyIdOf,
  familyRow,
  insertParentMember,
  insertPhoneAccount,
  signInByPhone,
  signedInParent,
} from '../helpers/parent';
import { anyText, auditRows } from '../helpers/sign-in';

import type { KeyObject } from 'node:crypto';

const NOW = Date.UTC(2026, 9, 9, 3, 30, 1);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
let clock = NOW;
const delivery = new RecordingDelivery();
const { db, app } = useDatabaseApp({}, { overrides: { now: () => clock, delivery } });

beforeEach(() => {
  clock = NOW;
});

const get = (url: string, token: string) => new Browser(app).get(url, { headers: bearer(token) });
const post = (url: string, token: string, body?: unknown) =>
  new Browser(app).post(url, body, { headers: bearer(token) });

async function guardian(name = 'Colombo International School') {
  const school = await insertSchool(db(), { name, shortName: 'CIS' });
  const account = await insertPhoneAccount(db());
  const userId = await insertParentMember(db(), school.id, account.id, 'guardian');
  const pair = await signedInParent(app, delivery, account.phone);
  return { school, account, userId, pair };
}

async function relative() {
  const school = await insertSchool(db());
  const account = await insertPhoneAccount(db());
  await insertParentMember(db(), school.id, account.id, 'relative', 'Sunil Perera');
  const pair = await signedInParent(app, delivery, account.phone);
  return { school, account, pair };
}

/** A guardian of A and a relative of B: the code gives the select_school token. */
async function choosing() {
  const a = await insertSchool(db(), { name: 'School A' });
  const b = await insertSchool(db(), { name: 'School B' });
  const account = await insertPhoneAccount(db());
  const inA = await insertParentMember(db(), a.id, account.id, 'guardian');
  await insertParentMember(db(), b.id, account.id, 'relative');
  const result = await signInByPhone(app, delivery, account.phone);
  expect(result.status).toBe('choose_school');
  return { a, b, account, inA, selectToken: String(result.accessToken) };
}

const privateKey = createPrivateKey(TEST_JWT_KEYS.JWT_PRIVATE_KEY);

/** Signs `claims` like the API would, unless told otherwise (the attacks below). */
async function sign(
  claims: Record<string, unknown>,
  options: { readonly key?: KeyObject; readonly alg?: string } = {},
): Promise<string> {
  const iat = Math.floor(clock / 1000);
  // Our own key id, as an attacker would copy it from any real token.
  const kid = await calculateJwkThumbprint(
    await exportJWK(createPublicKey(TEST_JWT_KEYS.JWT_PUBLIC_KEY)),
  );
  return new SignJWT({
    iss: 'http://localhost:3000',
    aud: 'quad:parent',
    iat,
    exp: iat + 900,
    ...claims,
  })
    .setProtectedHeader({ alg: options.alg ?? 'EdDSA', typ: 'JWT', kid })
    .sign(options.key ?? privateKey);
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('the bearer path (spec 06: Authorization: Bearer, mobile)', () => {
  it('opens GET /me in the token’s school for a guardian, with the other schools to switch to', async () => {
    const { school, account, pair } = await guardian();
    const other = await insertSchool(db(), { name: 'Kandy Hill Academy' });
    await insertParentMember(db(), other.id, account.id, 'guardian');
    const staffSchool = await insertSchool(db(), { name: 'Where they teach' });
    await insertParentMember(db(), staffSchool.id, account.id, 'staff');

    const response = await get('/me', pair.accessToken);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      person: { firstName: 'Dilhani' },
      school: { id: school.id, name: 'Colombo International School' },
      memberships: [{ tenantId: other.id, name: 'Kandy Hill Academy' }],
      preview: null,
      support: null,
    });
  });

  it('needs no CSRF token on a bearer write (PATCH /me)', async () => {
    const { pair } = await guardian();
    const response = await new Browser(app).request(
      'PATCH',
      '/me',
      { theme: 'dark' },
      {
        headers: bearer(pair.accessToken),
      },
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ person: { theme: 'dark' } });
  });

  it("sees only its own school's data: school A's token never shows school B", async () => {
    const a = await guardian('School A');
    const b = await guardian('School B');
    expect((await get('/me', a.pair.accessToken)).json()).toMatchObject({
      school: { id: a.school.id },
    });
    expect((await get('/me', b.pair.accessToken)).json()).toMatchObject({
      school: { id: b.school.id },
    });
  });

  it('lives 15 minutes: 200 at 14:59, 401 at 15:00', async () => {
    const { pair } = await guardian();
    clock = NOW + 15 * MINUTE - SECOND;
    expect((await get('/me', pair.accessToken)).statusCode).toBe(200);
    clock = NOW + 15 * MINUTE;
    expect((await get('/me', pair.accessToken)).statusCode).toBe(401);
  });

  describe('refuses a token that is not exactly ours (401)', () => {
    it('alg none', async () => {
      const { pair } = await guardian();
      const [, payload] = pair.accessToken.split('.');
      const none = `${encode({ alg: 'none', typ: 'JWT' })}.${payload}.`;
      expect((await get('/me', none)).statusCode).toBe(401);
    });

    it('HS256 keyed with our public key (algorithm confusion)', async () => {
      const { pair } = await guardian();
      const hmacKey = createSecretKey(Buffer.from(TEST_JWT_KEYS.JWT_PUBLIC_KEY));
      const token = await sign(claimsOf(pair.accessToken), { key: hmacKey, alg: 'HS256' });
      expect((await get('/me', token)).statusCode).toBe(401);
    });

    it('signed with another Ed25519 key', async () => {
      const { pair } = await guardian();
      const token = await sign(claimsOf(pair.accessToken), {
        key: generateKeyPairSync('ed25519').privateKey,
      });
      expect((await get('/me', token)).statusCode).toBe(401);
    });

    it.each([
      ['another issuer', { iss: 'https://evil.example' }],
      ['another audience', { aud: 'quad:staff' }],
      ['an expired token', { exp: Math.floor(NOW / 1000) }],
      ['no expiry', { exp: undefined }],
    ])('%s', async (_case, change) => {
      const { pair } = await guardian();
      const token = await sign({ ...claimsOf(pair.accessToken), ...change });
      expect((await get('/me', token)).statusCode).toBe(401);
    });

    it('a changed payload (another school) under the original signature', async () => {
      const a = await guardian('School A');
      const b = await guardian('School B');
      const [header, , signature] = a.pair.accessToken.split('.');
      const payload = encode({ ...claimsOf(a.pair.accessToken), tid: b.school.id });
      expect((await get('/me', `${header}.${payload}.${signature}`)).statusCode).toBe(401);
    });

    it('a well-signed token whose claims no longer match its family (another membership)', async () => {
      const a = await guardian('School A');
      const b = await guardian('School B');
      // Our own key, but B's membership in A's family: the claims must match the family row.
      const token = await sign({
        ...claimsOf(a.pair.accessToken),
        sub: b.userId,
        tid: b.school.id,
      });
      expect((await get('/me', token)).statusCode).toBe(401);
      // Only the school changed: the family's school is A, so the claim must say A.
      const schoolOnly = await sign({ ...claimsOf(a.pair.accessToken), tid: b.school.id });
      expect((await get('/me', schoolOnly)).statusCode).toBe(401);
      const kindOnly = await sign({ ...claimsOf(a.pair.accessToken), kind: 'relative' });
      expect((await get('/me', kindOnly)).statusCode).toBe(401);
    });

    it.each(['Bearer', 'Bearer ', 'Basic dXNlcjpwYXNz', 'Bearer not.a.jwt'])(
      'the Authorization header %j',
      async (authorization) => {
        const response = await new Browser(app).get('/me', { headers: { authorization } });
        expect(response.statusCode).toBe(401);
      },
    );
  });

  it('never reaches a staff membership: a token naming one is refused (401)', async () => {
    const school = await insertSchool(db());
    const { account, pair } = await guardian();
    const staffUser = await insertParentMember(db(), school.id, account.id, 'staff');
    const token = await sign({ ...claimsOf(pair.accessToken), sub: staffUser, tid: school.id });
    expect((await get('/me', token)).statusCode).toBe(401);
    const asStaff = await sign({ ...claimsOf(pair.accessToken), kind: 'staff' });
    expect((await get('/me', asStaff)).statusCode).toBe(401);
  });

  it('a select_school token opens nothing but select-school and sign-out (401 on GET /me)', async () => {
    const { selectToken } = await choosing();
    expect((await get('/me', selectToken)).statusCode).toBe(401);
  });
});

describe('key ids and rotation (Task 9 fix round 1)', () => {
  it('refuses a token with no kid, or with a kid that is not ours', async () => {
    const { pair } = await guardian();
    const claims = claimsOf(pair.accessToken);
    const iat = Math.floor(clock / 1000);
    const noKid = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
      .sign(privateKey);
    const otherKid = await new SignJWT({ ...claims, iat, exp: iat + 900 })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid: 'not-our-key' })
      .sign(privateKey);
    expect((await get('/me', noKid)).statusCode).toBe(401);
    expect((await get('/me', otherKid)).statusCode).toBe(401);
  });

  it('refuses a token signed by a previous key when JWT_PUBLIC_KEY_PREVIOUS is not set', async () => {
    const { pair } = await guardian();
    const old = generateKeyPairSync('ed25519');
    const kid = await calculateJwkThumbprint(await exportJWK(old.publicKey));
    const token = await new SignJWT(claimsOf(pair.accessToken))
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid })
      .sign(old.privateKey);
    expect((await get('/me', token)).statusCode).toBe(401);
  });

  describe('with JWT_PUBLIC_KEY_PREVIOUS', () => {
    const old = generateKeyPairSync('ed25519');
    const rotatedDelivery = new RecordingDelivery();
    const rotated = useDatabaseApp(
      {
        JWT_PUBLIC_KEY_PREVIOUS: old.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      },
      { overrides: { now: () => clock, delivery: rotatedDelivery } },
    );

    it('accepts a token the previous key signed, by its kid, and signs new ones with the current key', async () => {
      const school = await insertSchool(rotated.db());
      const account = await insertPhoneAccount(rotated.db());
      await insertParentMember(rotated.db(), school.id, account.id);
      const pair = await signedInParent(rotated.app, rotatedDelivery, account.phone);
      const currentKid = await calculateJwkThumbprint(
        await exportJWK(createPublicKey(TEST_JWT_KEYS.JWT_PUBLIC_KEY)),
      );
      expect(decodeProtectedHeader(pair.accessToken).kid).toBe(currentKid);
      const oldKid = await calculateJwkThumbprint(await exportJWK(old.publicKey));
      const signedBefore = await new SignJWT(claimsOf(pair.accessToken))
        .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid: oldKid })
        .sign(old.privateKey);
      const response = await new Browser(rotated.app).get('/me', { headers: bearer(signedBefore) });
      expect(response.statusCode).toBe(200);
      // The old key's kid with the current key's signature is not ours.
      const mixed = await new SignJWT(claimsOf(pair.accessToken))
        .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid: oldKid })
        .sign(privateKey);
      expect(
        (await new Browser(rotated.app).get('/me', { headers: bearer(mixed) })).statusCode,
      ).toBe(401);
    });
  });
});

describe('a deactivated membership (Task 9 fix round 1)', () => {
  it('answers 401 to its access token', async () => {
    const { pair, userId } = await guardian();
    await db().platform.query(`update users set status = 'deactivated' where id = $1`, [userId]);
    expect((await get('/me', pair.accessToken)).statusCode).toBe(401);
  });

  it('answers 401 at once after invalidateMember, even when the token was just used (cached)', async () => {
    const { pair, userId, account, school } = await guardian();
    expect((await get('/me', pair.accessToken)).statusCode).toBe(200);
    await db().platform.query(`update users set status = 'deactivated' where id = $1`, [userId]);
    await app().get(SessionService).invalidateMember(account.id, school.id);
    expect((await get('/me', pair.accessToken)).statusCode).toBe(401);
  });
});

describe('relative tokens reach only refresh and sign-out in M1 (D32)', () => {
  it('answers 403 on GET /me', async () => {
    const { pair } = await relative();
    const response = await get('/me', pair.accessToken);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
  });

  it('answers 403 on every route that needs a session, except sign-out', async () => {
    const { pair } = await relative();
    const checked: string[] = [];
    for (const route of API_ROUTES) {
      const url = route.path.replace('{provider}', 'google').replace(/\{\w+\}/g, randomUUID());
      const method = route.method.toUpperCase() as 'GET' | 'POST' | 'PATCH' | 'DELETE';
      if (`${method} ${url}` === 'POST /auth/sign-out') continue;
      const anonymous = await new Browser(app).request(method, url);
      if (anonymous.statusCode !== 401) continue; // a public route: no token is read
      const response = await new Browser(app).request(method, url, undefined, {
        headers: bearer(pair.accessToken),
      });
      expect({ route: `${method} ${url}`, status: response.statusCode }).toEqual({
        route: `${method} ${url}`,
        status: 403,
      });
      checked.push(`${method} ${route.path}`);
    }
    expect(checked).toEqual(
      expect.arrayContaining([
        'GET /me',
        'PATCH /me',
        'GET /auth/memberships',
        'POST /auth/select-school',
      ]),
    );
  });

  it('can refresh and sign out', async () => {
    const { pair } = await relative();
    const response = await new Browser(app).post('/auth/refresh', {
      refreshToken: pair.refreshToken,
    });
    expect(response.statusCode).toBe(200);
    const next = TokenPair.parse(response.json());
    expect(claimsOf(next.accessToken).kind).toBe('relative');
    expect((await post('/auth/sign-out', next.accessToken)).statusCode).toBe(204);
  });
});

describe('POST /auth/select-school with a bearer token (OQ20, the kind rule)', () => {
  it('opens the chosen school: a tenant pair, a family in that school, and the token is used up', async () => {
    const { a, inA, account, selectToken } = await choosing();

    const response = await post('/auth/select-school', selectToken, { tenantId: a.id });

    expect(response.statusCode).toBe(200);
    const pair = TokenPair.parse(response.json());
    const sessionId = familyIdOf(pair.refreshToken);
    expect(claimsOf(pair.accessToken)).toMatchObject({
      scope: 'tenant',
      tid: a.id,
      sub: inA,
      acc: account.id,
      kind: 'guardian',
      sid: sessionId,
    });
    expect(claimsOf(selectToken).sid).toBe(sessionId);
    expect(await familyRow(db(), sessionId)).toMatchObject({
      stage: 'active',
      active_tenant_id: a.id,
      active_user_id: inA,
    });
    expect((await get('/me', pair.accessToken)).json()).toMatchObject({ school: { id: a.id } });
    expect((await post('/auth/select-school', selectToken, { tenantId: a.id })).statusCode).toBe(
      401,
    );
    const audits = (await auditRows(db(), 'auth.sign_in')).filter((row) => row.tenant_id === a.id);
    expect(audits).toHaveLength(1);
  });

  it('opens a relative membership too', async () => {
    const { b, selectToken } = await choosing();
    const response = await post('/auth/select-school', selectToken, { tenantId: b.id });
    expect(response.statusCode).toBe(200);
    expect(claimsOf(TokenPair.parse(response.json()).accessToken).kind).toBe('relative');
  });

  it('answers 403 for a school the account does not belong to, and the token still works', async () => {
    const { a, selectToken } = await choosing();
    const stranger = await insertSchool(db());
    const response = await post('/auth/select-school', selectToken, { tenantId: stranger.id });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
    expect((await post('/auth/select-school', selectToken, { tenantId: a.id })).statusCode).toBe(
      200,
    );
  });

  it('answers 403 for a staff membership (Review Focus #2, bearer side)', async () => {
    const { account, selectToken } = await choosing();
    const staffSchool = await insertSchool(db());
    await insertParentMember(db(), staffSchool.id, account.id, 'staff');
    const response = await post('/auth/select-school', selectToken, { tenantId: staffSchool.id });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
  });

  it("answers 403 for another account's school (B's membership never opens for A)", async () => {
    const mine = await choosing();
    const theirs = await choosing();
    const response = await post('/auth/select-school', mine.selectToken, { tenantId: theirs.a.id });
    expect(response.statusCode).toBe(403);
  });

  it('answers 403 school_suspended for a suspended school, with its reason', async () => {
    const { account, selectToken } = await choosing();
    const paused = await insertSchool(db(), {
      status: 'suspended',
      suspendReason: 'Unpaid invoice',
    });
    await insertParentMember(db(), paused.id, account.id);
    const response = await post('/auth/select-school', selectToken, { tenantId: paused.id });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'school_suspended', message: 'Unpaid invoice' });
  });

  it('answers 400 validation without a school', async () => {
    const { selectToken } = await choosing();
    const response = await post('/auth/select-school', selectToken, {});
    expect(response.statusCode).toBe(400);
  });

  it('answers 401 once the 5 minutes are over', async () => {
    const { a, selectToken } = await choosing();
    clock = NOW + 5 * MINUTE;
    expect((await post('/auth/select-school', selectToken, { tenantId: a.id })).statusCode).toBe(
      401,
    );
  });

  describe('a switch with a school token (Task 9 fix round 1: the family keeps its refresh token)', () => {
    async function inTwoSchools() {
      const { a, account, selectToken } = await choosing();
      const b = await insertSchool(db(), { name: 'School C' });
      await insertParentMember(db(), b.id, account.id, 'guardian');
      const inA = TokenPair.parse(
        (await post('/auth/select-school', selectToken, { tenantId: a.id })).json(),
      );
      return { a, b, inA };
    }

    it('answers only an access token for the new school, and no refresh token', async () => {
      const { b, inA } = await inTwoSchools();
      const response = await post('/auth/select-school', inA.accessToken, { tenantId: b.id });
      expect(response.statusCode).toBe(200);
      const body = response.json<Record<string, unknown>>();
      expect(Object.keys(body)).toEqual(['accessToken']);
      expect(claimsOf(String(body.accessToken)).tid).toBe(b.id);
      expect((await get('/me', String(body.accessToken))).json()).toMatchObject({
        school: { id: b.id },
      });
    });

    it("stops the old school's access token (401)", async () => {
      const { b, inA } = await inTwoSchools();
      await post('/auth/select-school', inA.accessToken, { tenantId: b.id });
      expect((await get('/me', inA.accessToken)).statusCode).toBe(401);
    });

    it('keeps the refresh token working, and it then refreshes into the new school', async () => {
      const { b, inA } = await inTwoSchools();
      const sessionId = familyIdOf(inA.refreshToken);
      const before = await familyRow(db(), sessionId);
      await post('/auth/select-school', inA.accessToken, { tenantId: b.id });
      const after = await familyRow(db(), sessionId);
      expect(after.refresh_generation).toBe(before.refresh_generation);
      expect(after.refresh_hash?.equals(before.refresh_hash ?? Buffer.alloc(0))).toBe(true);
      expect(after.active_tenant_id).toBe(b.id);

      const refreshed = await new Browser(app).post('/auth/refresh', {
        refreshToken: inA.refreshToken,
      });
      expect(refreshed.statusCode).toBe(200);
      const pair = TokenPair.parse(refreshed.json());
      expect(claimsOf(pair.accessToken).tid).toBe(b.id);
      expect((await familyRow(db(), sessionId)).revoked_at).toBeNull();
    });

    it('answers 400 for the school the token is already in', async () => {
      const { a, inA } = await inTwoSchools();
      const response = await post('/auth/select-school', inA.accessToken, { tenantId: a.id });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        code: 'validation',
        fields: { tenantId: anyText() },
      });
      expect((await get('/me', inA.accessToken)).statusCode).toBe(200);
    });
  });

  it('sets no cookies: the staff cookie flow stays separate (select-school.api.test.ts)', async () => {
    const { a, selectToken } = await choosing();
    const response = await post('/auth/select-school', selectToken, { tenantId: a.id });
    expect(response.cookies).toEqual([]);
  });
});

describe('POST /auth/sign-out with a bearer token (spec 05 step 7)', () => {
  it("answers 204, revokes this device's family, and audits it in the school", async () => {
    const { school, pair } = await guardian();
    const sessionId = familyIdOf(pair.refreshToken);
    const before = (await auditRows(db(), 'auth.sign_out')).length;

    const response = await post('/auth/sign-out', pair.accessToken);

    expect(response.statusCode).toBe(204);
    expect((await familyRow(db(), sessionId)).revoked_at).not.toBeNull();
    expect(
      (await new Browser(app).post('/auth/refresh', { refreshToken: pair.refreshToken }))
        .statusCode,
    ).toBe(401);
    expect((await get('/me', pair.accessToken)).statusCode).toBe(401);
    const audits = (await auditRows(db(), 'auth.sign_out')).slice(before);
    expect(audits.map((row) => row.tenant_id)).toEqual([school.id]);
  });

  it("signs out only this device: the same parent's other phone keeps working", async () => {
    const { account, pair } = await guardian();
    clock = NOW + 31 * SECOND;
    const otherPhone = await signedInParent(app, delivery, account.phone);
    await post('/auth/sign-out', pair.accessToken);
    expect((await get('/me', otherPhone.accessToken)).statusCode).toBe(200);
  });

  it('signs out a sign-in that is still choosing a school', async () => {
    const { a, selectToken } = await choosing();
    expect((await post('/auth/sign-out', selectToken)).statusCode).toBe(204);
    expect((await post('/auth/select-school', selectToken, { tenantId: a.id })).statusCode).toBe(
      401,
    );
  });

  it('answers 401 without a token', async () => {
    expect((await new Browser(app).post('/auth/sign-out')).statusCode).toBe(401);
  });
});
