import { Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';

import { SessionService } from '../../src/common/session/session.service';
import { TENANT_DB } from '../../src/tokens';
import { useDatabaseApp } from '../helpers/database-app';
import {
  insertAccount,
  insertMember,
  insertPlatformUser,
  insertSchool,
  insertSupportVisit,
  insertWebSession,
  sessionHeaders,
  setSchoolStatus,
  signedInMember,
} from '../helpers/identity';

import { AccessProbeModule } from './probe.module';

import type { QuadTenantDb } from '@quad/db';

const HOUR_MS = 60 * 60 * 1000;
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const { db, app } = useDatabaseApp({}, { overrides: { testModules: [AccessProbeModule] } });

const request = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  headers: Record<string, string> = {},
) =>
  app()
    .getHttpAdapter()
    .getInstance()
    .inject({ method, url: `/api/v1${url}`, headers });

const getMe = (headers: Record<string, string>) => request('GET', '/me', headers);
const sessions = () => app().get(SessionService);
const tenantDb = () => app().get<symbol, QuadTenantDb>(TENANT_DB);

describe('the global AuthGuard', () => {
  it('answers 401 unauthorized without a cookie, or with one that names no session', async () => {
    for (const headers of [
      {},
      { cookie: 'quad_sid=not-a-token' },
      sessionHeaders({ token: 'A'.repeat(43), csrf: 'x' }),
    ]) {
      const response = await getMe(headers);
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: 'unauthorized' });
    }
  });

  it('lets an active session through', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    expect((await getMe(sessionHeaders(session))).statusCode).toBe(200);
  });

  it('answers /health/live and /openapi.json without a session (@Public)', async () => {
    expect((await request('GET', '/health/live')).statusCode).toBe(200);
    expect((await request('GET', '/openapi.json')).statusCode).toBe(200);
    expect((await request('GET', '/probe/public')).statusCode).toBe(200);
  });

  it('needs an active session on a route without a marker (the @Can default)', async () => {
    expect((await request('GET', '/probe/unmarked')).statusCode).toBe(401);
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    expect((await request('GET', '/probe/unmarked', sessionHeaders(session))).statusCode).toBe(200);
  });

  it('leaves a @PlatformController() class to its own guard', async () => {
    const response = await request('GET', '/platform/probe');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('lets a sign-in step through @PreAuth only at its stage, and never to an active route', async () => {
    const accountId = await insertAccount(db());
    const twoStep = await insertWebSession(db(), accountId, { stage: 'two_step' });
    expect((await request('POST', '/probe/two-step', sessionHeaders(twoStep))).statusCode).toBe(
      201,
    );
    expect((await getMe(sessionHeaders(twoStep))).statusCode).toBe(401);

    const choosing = await insertWebSession(db(), accountId, { stage: 'choose_school' });
    expect((await request('POST', '/probe/two-step', sessionHeaders(choosing))).statusCode).toBe(
      401,
    );
    expect((await request('POST', '/probe/choose', sessionHeaders(choosing))).statusCode).toBe(201);
    expect((await getMe(sessionHeaders(choosing))).statusCode).toBe(401);
  });

  it('fills the request context from the session, never from the request', async () => {
    const school = await insertSchool(db());
    const { accountId, userId, session } = await signedInMember(db(), school);
    const response = await request('GET', '/probe/context', {
      ...sessionHeaders(session),
      'x-tenant-id': '00000000-0000-4000-8000-000000000000',
    });
    expect(response.json()).toEqual({
      tenantId: school.id,
      userId,
      accountId,
      kind: 'web',
      previewRoleId: null,
      supportSessionId: null,
    });
  });

  it('counts the signed-in member for the per-user rate limit (spec 06)', async () => {
    const school = await insertSchool(db());
    const { userId, session } = await signedInMember(db(), school);
    await getMe(sessionHeaders(session));
    const redis = new Redis(REDIS_URL);
    try {
      expect(await redis.keys(`quad:rl:user:${userId}:*`)).toHaveLength(1);
    } finally {
      await redis.quit();
    }
  });
});

describe('session expiry (sessionExpiry, spec 05)', () => {
  it("is 401 once the session has been idle for the school's session hours", async () => {
    const school = await insertSchool(db(), { sessionHours: 4 });
    const accountId = await insertAccount(db());
    const userId = await insertMember(db(), school.id, accountId);
    const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * HOUR_MS);
    const idle = await insertWebSession(db(), accountId, {
      tenantId: school.id,
      userId,
      lastSeenAt: at(4.1),
    });
    const fresh = await insertWebSession(db(), accountId, {
      tenantId: school.id,
      userId,
      lastSeenAt: at(3.9),
    });
    expect((await getMe(sessionHeaders(idle))).statusCode).toBe(401);
    expect((await getMe(sessionHeaders(fresh))).statusCode).toBe(200);
  });

  it('defaults to 12 hours idle, and 30 days with "Keep me signed in"', async () => {
    const school = await insertSchool(db());
    const accountId = await insertAccount(db());
    const userId = await insertMember(db(), school.id, accountId);
    const lastSeenAt = new Date(Date.now() - 13 * HOUR_MS);
    const expiresAt = new Date(Date.now() + 29 * 24 * HOUR_MS);
    const idle = await insertWebSession(db(), accountId, {
      tenantId: school.id,
      userId,
      lastSeenAt,
    });
    const kept = await insertWebSession(db(), accountId, {
      tenantId: school.id,
      userId,
      lastSeenAt,
      expiresAt,
      keepSignedIn: true,
    });
    expect((await getMe(sessionHeaders(idle))).statusCode).toBe(401);
    expect((await getMe(sessionHeaders(kept))).statusCode).toBe(200);
  });

  it("is 401 past the row's expires_at", async () => {
    const school = await insertSchool(db());
    const accountId = await insertAccount(db());
    const userId = await insertMember(db(), school.id, accountId);
    const ended = await insertWebSession(db(), accountId, {
      tenantId: school.id,
      userId,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect((await getMe(sessionHeaders(ended))).statusCode).toBe(401);
  });

  it('records activity: an idle-ish session gets a new last_seen_at and expiry', async () => {
    const school = await insertSchool(db());
    const accountId = await insertAccount(db());
    const userId = await insertMember(db(), school.id, accountId);
    const lastSeenAt = new Date(Date.now() - HOUR_MS);
    const session = await insertWebSession(db(), accountId, {
      tenantId: school.id,
      userId,
      lastSeenAt,
    });
    expect((await getMe(sessionHeaders(session))).statusCode).toBe(200);
    const { rows } = await db().platform.query<{ last_seen_at: Date; expires_at: Date }>(
      'select last_seen_at, expires_at from sessions where id = $1',
      [session.id],
    );
    const [row] = rows;
    expect(row?.last_seen_at.getTime()).toBeGreaterThan(lastSeenAt.getTime() + HOUR_MS / 2);
    expect((row?.expires_at.getTime() ?? 0) - (row?.last_seen_at.getTime() ?? 0)).toBe(
      12 * HOUR_MS,
    );
  });
});

describe('revocation reaches the next request (the Redis cache, D32)', () => {
  it('is 401 at once after DELETE /me/sessions/:id, though the session was cached', async () => {
    const school = await insertSchool(db());
    const { accountId, userId, session } = await signedInMember(db(), school);
    const other = await insertWebSession(db(), accountId, { tenantId: school.id, userId });
    expect((await getMe(sessionHeaders(session))).statusCode).toBe(200);

    const revoked = await request('DELETE', `/me/sessions/${session.id}`, sessionHeaders(other));
    expect(revoked.statusCode).toBe(204);
    expect((await getMe(sessionHeaders(session))).statusCode).toBe(401);
    expect((await getMe(sessionHeaders(other))).statusCode).toBe(200);
  });

  it('invalidateMember drops every cached session of an account in one school (Task 13)', async () => {
    const schoolA = await insertSchool(db());
    const schoolB = await insertSchool(db());
    const { accountId, userId, session } = await signedInMember(db(), schoolA);
    const inB = await signedInMember(db(), schoolB, { accountId });
    expect((await getMe(sessionHeaders(session))).statusCode).toBe(200);
    expect((await getMe(sessionHeaders(inB.session))).statusCode).toBe(200);

    await tenantDb().withTenant(schoolA.id, (tx) =>
      tenantDb().definers.revokeMemberSessions(tx, userId),
    );
    // Still cached: revoke_member_sessions knows nothing of Redis.
    expect((await getMe(sessionHeaders(session))).statusCode).toBe(200);

    await sessions().invalidateMember(accountId, schoolA.id);
    expect((await getMe(sessionHeaders(session))).statusCode).toBe(401);
    // School B's session is untouched, in Postgres and in the cache.
    expect((await getMe(sessionHeaders(inB.session))).statusCode).toBe(200);
  });

  it('invalidateAccount drops the cached sessions of an account in every school', async () => {
    const schoolA = await insertSchool(db());
    const schoolB = await insertSchool(db());
    const inA = await signedInMember(db(), schoolA);
    const inB = await signedInMember(db(), schoolB, { accountId: inA.accountId });
    for (const seed of [inA, inB]) {
      expect((await getMe(sessionHeaders(seed.session))).statusCode).toBe(200);
    }
    await db().platform.query('update sessions set revoked_at = now() where account_id = $1', [
      inA.accountId,
    ]);
    await sessions().invalidateAccount(inA.accountId);
    for (const seed of [inA, inB]) {
      expect((await getMe(sessionHeaders(seed.session))).statusCode).toBe(401);
    }
  });
});

describe('memberships and schools (ruling F09)', () => {
  it('is 401 for a deactivated membership', async () => {
    const school = await insertSchool(db());
    const { userId, session } = await signedInMember(db(), school);
    await db().platform.query(`update users set status = 'deactivated' where id = $1`, [userId]);
    expect((await getMe(sessionHeaders(session))).statusCode).toBe(401);
  });

  it('is 401 for a removed membership', async () => {
    const school = await insertSchool(db());
    const { userId, session } = await signedInMember(db(), school);
    await db().platform.query('update users set deleted_at = now() where id = $1', [userId]);
    expect((await getMe(sessionHeaders(session))).statusCode).toBe(401);
  });

  it('is 401 for a deleted school', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    await setSchoolStatus(db(), school.id, 'deleted');
    expect((await getMe(sessionHeaders(session))).statusCode).toBe(401);
  });

  it('is not a 401 for a suspended school (TenantStatusGuard answers 403 in Task 12)', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    await setSchoolStatus(db(), school.id, 'suspended');
    expect((await getMe(sessionHeaders(session))).statusCode).not.toBe(401);
  });

  it("is 401 for a membership of another account (the session's account must own it)", async () => {
    const school = await insertSchool(db());
    const someoneElse = await signedInMember(db(), school);
    const accountId = await insertAccount(db());
    const session = await insertWebSession(db(), accountId, {
      tenantId: school.id,
      userId: someoneElse.userId,
    });
    expect((await getMe(sessionHeaders(session))).statusCode).toBe(401);
  });
});

describe('support visits (ruling R-support-token)', () => {
  it('works without a membership while the visit is active, and is 401 once it has ended', async () => {
    const school = await insertSchool(db());
    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    const visit = await insertSupportVisit(db(), staff, school.id);

    const during = await getMe(sessionHeaders(visit));
    expect(during.statusCode).toBe(200);
    expect(during.json()).toMatchObject({
      school: { id: school.id },
      support: { schoolName: school.name, platformUserName: 'Ruwan Mendis' },
    });
    const context = await request('GET', '/probe/context', sessionHeaders(visit));
    expect(context.json()).toMatchObject({
      tenantId: school.id,
      userId: null,
      accountId: null,
      kind: 'support',
      supportSessionId: visit.id,
    });

    // "Exit to platform" (Task 16) ends the visit, then drops the cookie's cache entry.
    await tenantDb().definers.endSupportSession(visit.tokenHash);
    await sessions().invalidateToken(visit.tokenHash);
    expect((await getMe(sessionHeaders(visit))).statusCode).toBe(401);
  });

  it('is 401 after its hard limit, even while cached', async () => {
    const school = await insertSchool(db());
    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    const visit = await insertSupportVisit(db(), staff, school.id, {
      expiresAt: new Date(Date.now() + 1500),
    });
    expect((await getMe(sessionHeaders(visit))).statusCode).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 1600));
    expect((await getMe(sessionHeaders(visit))).statusCode).toBe(401);
  });

  it("never reaches another school's data: the visit's school comes from support_sessions", async () => {
    const schoolA = await insertSchool(db());
    const schoolB = await insertSchool(db());
    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    const visit = await insertSupportVisit(db(), staff, schoolA.id);
    const response = await getMe({ ...sessionHeaders(visit), 'x-tenant-id': schoolB.id });
    expect(response.json()).toMatchObject({ school: { id: schoolA.id } });
  });
});
