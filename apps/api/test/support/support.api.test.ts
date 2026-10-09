import { createHmac } from 'node:crypto';

import {
  Me,
  PlatformTenantList,
  School,
  SupportSessionExit,
  SupportSessionLink,
} from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { hashSessionToken, newSessionToken } from '../../src/common/session/cookies';
import { CsrfTokens } from '../../src/common/session/csrf';
import { localEnv } from '../env';
import { GuardsProbeModule } from '../guards/probe.module';
import { auditEntries } from '../helpers/access';
import { Browser, setCookie } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertSchool } from '../helpers/identity';
import {
  CONSOLE_CSRF,
  CONSOLE_SID,
  consoleBrowser,
  insertConsoleSession,
  insertConsoleUser,
  platformAuditRows,
} from '../helpers/platform';
import { asStaff, schoolWithRoles, staffHolding } from '../helpers/users';

import type { PlatformRole } from '@quad/contracts';
import type { LightMyRequestResponse as Response } from 'fastify';

/**
 * Support access, "Open as school admin" (spec 05; Task 16), end to end: the console opens a
 * reasoned visit, the staff portal redeems its single-use link, the visit acts as the school's
 * admin minus safeguarding and medical with every write audited twice, and it ends at 60 minutes
 * or on "Exit to platform".
 */

const MINUTE_MS = 60 * 1000;
/** The app's clock, moved by the tests (signed-link and visit expiry). */
let clock = Date.now();

const { db, app } = useDatabaseApp(
  {},
  { overrides: { now: () => clock, testModules: [GuardsProbeModule] } },
);

const env = localEnv();
const PUBLIC_WEB_URL = env.PUBLIC_WEB_URL ?? '';
const CONSOLE_URL = env.CONSOLE_URL ?? '';
const LINK_PATH = '/sign-in/support/';

/** A console browser signed in as a new console user with `role`. */
async function consoleAs(role: PlatformRole) {
  const user = await insertConsoleUser(db(), { role, name: `Quad ${role} person` });
  const { token, csrf } = await insertConsoleSession(db(), user.id);
  const browser = consoleBrowser(app);
  browser.cookies.set(CONSOLE_SID, token);
  browser.cookies.set(CONSOLE_CSRF, csrf);
  return { browser, id: user.id, name: user.name };
}

const REASON = 'The school asked for help with its staff invitations.';

const open = (browser: Browser, tenantId: string, body: unknown = { reason: REASON }) =>
  browser.post(`/platform/tenants/${tenantId}/support-session`, body);

/** Opens a visit and returns the link's token. */
async function linkFor(browser: Browser, tenantId: string): Promise<string> {
  const response = await open(browser, tenantId);
  expect(response.statusCode).toBe(200);
  const { url } = SupportSessionLink.parse(response.json());
  expect(url.startsWith(new URL(LINK_PATH, PUBLIC_WEB_URL).href)).toBe(true);
  return url.slice(url.indexOf(LINK_PATH) + LINK_PATH.length);
}

const redeem = (browser: Browser, token: string) =>
  browser.post('/auth/support-session', { token });

/** The staff portal's browser in a support visit to `tenantId`, opened by a `support` user. */
async function visiting(tenantId: string) {
  const quad = await consoleAs('support');
  const token = await linkFor(quad.browser, tenantId);
  const staff = new Browser(app);
  const response = await redeem(staff, token);
  expect(response.statusCode).toBe(200);
  return { quad, staff, token };
}

async function supportRows(tenantId: string) {
  const { rows } = await db().platform.query<{
    id: string;
    platform_user_id: string;
    reason: string;
    expires_at: Date;
    started_at: Date;
    ended_at: Date | null;
    redeemed: boolean;
  }>(
    `select id, platform_user_id, reason, expires_at, started_at, ended_at,
            token_hash is not null as redeemed
     from support_sessions where tenant_id = $1 order by started_at`,
    [tenantId],
  );
  return rows;
}

const codeOf = (response: Response) => response.json<{ code: string }>().code;

describe('POST /platform/tenants/:id/support-session', () => {
  it.each(['support', 'admin', 'owner'] as const)(
    'gives a %s user a single-use link, with the reason logged and a 60-minute visit',
    async (role) => {
      clock = Date.now();
      const school = await insertSchool(db());
      const quad = await consoleAs(role);

      const response = await open(quad.browser, school.id);

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const { url } = SupportSessionLink.parse(response.json());
      expect(url).toMatch(/\/sign-in\/support\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      const [visit, ...others] = await supportRows(school.id);
      expect(others).toEqual([]);
      expect(visit).toMatchObject({
        platform_user_id: quad.id,
        reason: REASON,
        ended_at: null,
        redeemed: false,
      });
      expect(visit?.expires_at.getTime()).toBe(clock + 60 * MINUTE_MS);
      // No sessions row is written for a support visit (R-support-token).
      const { rows: sessions } = await db().platform.query(
        'select 1 from sessions where support_session_id = $1',
        [visit?.id],
      );
      expect(sessions).toEqual([]);
      expect(await platformAuditRows(db(), 'support_session.started', visit?.id ?? '')).toEqual([
        {
          actor_platform_user_id: quad.id,
          target_type: 'support_session',
          target_id: visit?.id,
          ip: quad.browser.ip,
          meta: { reason: REASON },
        },
      ]);
    },
  );

  it('answers 400 validation for a missing, short or long reason, or a bad id, and opens nothing', async () => {
    const school = await insertSchool(db());
    const quad = await consoleAs('support');
    for (const body of [
      {},
      { reason: '' },
      { reason: 'Too short' },
      { reason: 'x'.repeat(501) },
      { reason: REASON, tenantId: school.id },
    ]) {
      const response = await open(quad.browser, school.id, body);
      expect(response.statusCode).toBe(400);
      expect(codeOf(response)).toBe('validation');
    }
    const badId = await quad.browser.post('/platform/tenants/colombo-intl/support-session', {
      reason: REASON,
    });
    expect(badId.statusCode).toBe(400);
    expect(await supportRows(school.id)).toEqual([]);
  });

  it.each(['billing', 'readonly'] as const)(
    'answers 403 forbidden to a %s user, and opens nothing',
    async (role) => {
      const school = await insertSchool(db());
      const quad = await consoleAs(role);
      const response = await open(quad.browser, school.id);
      expect(response.statusCode).toBe(403);
      expect(codeOf(response)).toBe('forbidden');
      expect(await supportRows(school.id)).toEqual([]);
    },
  );

  it('answers 401 without a console session, and to a school member’s cookie', async () => {
    const school = await schoolWithRoles(db());
    const admin = await staffHolding(db(), school, school.roles.admin);
    expect((await open(consoleBrowser(app), school.id)).statusCode).toBe(401);
    const asMember = await asStaff(app, admin.session)(
      'POST',
      `/platform/tenants/${school.id}/support-session`,
      { reason: REASON },
    );
    expect(asMember.statusCode).toBe(401);
    expect(await supportRows(school.id)).toEqual([]);
  });

  it('answers 404 for an unknown or deleted school', async () => {
    const quad = await consoleAs('support');
    const unknown = await open(quad.browser, '018f6b3a-0000-7000-8000-00000000dead');
    expect(unknown.statusCode).toBe(404);
    expect(codeOf(unknown)).toBe('not_found');
    const deleted = await insertSchool(db(), { status: 'deleted' });
    expect((await open(quad.browser, deleted.id)).statusCode).toBe(404);
    expect(await supportRows(deleted.id)).toEqual([]);
  });
});

describe('POST /auth/support-session (the signed link)', () => {
  it('opens the staff portal in the school as Quad support, with the banner and a school audit entry', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const quad = await consoleAs('support');
    const token = await linkFor(quad.browser, school.id);
    const staff = new Browser(app);

    const response = await redeem(staff, token);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ next: 'done' });
    expect(response.headers['cache-control']).toBe('no-store');
    const cookie = setCookie(response, 'quad_sid');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    // The cookie ends with the visit, never later.
    expect(cookie?.maxAge).toBeGreaterThan(59 * 60);
    expect(cookie?.maxAge).toBeLessThanOrEqual(60 * 60);

    const me = Me.parse((await staff.get('/me')).json());
    expect(me.support).toEqual({ schoolName: school.name, platformUserName: quad.name });
    expect(me.school.name).toBe(school.name);

    const [visit] = await supportRows(school.id);
    expect(visit?.redeemed).toBe(true);
    const started = (await auditEntries(db(), 'support_session.started')).filter(
      (row) => row.tenant_id === school.id,
    );
    expect(started).toEqual([
      expect.objectContaining({
        actor_user_id: null,
        actor_platform_user_id: quad.id,
        target_type: 'support_session',
        target_id: visit?.id,
      }),
    ]);
    // The console's own entry was written when the link was made; redeeming adds none.
    expect(await platformAuditRows(db(), 'support_session.started', visit?.id ?? '')).toHaveLength(
      1,
    );
  });

  it('works once: a second use is 400 invalid_link and sets no cookie', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const quad = await consoleAs('support');
    const token = await linkFor(quad.browser, school.id);
    expect((await redeem(new Browser(app), token)).statusCode).toBe(200);

    const again = new Browser(app);
    const response = await redeem(again, token);

    expect(response.statusCode).toBe(400);
    expect(codeOf(response)).toBe('invalid_link');
    expect(response.body).not.toContain(school.name);
    expect(again.cookies.has('quad_sid')).toBe(false);
  });

  it('refuses a link after its 2 minutes, and the visit is never redeemed', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const quad = await consoleAs('support');
    const token = await linkFor(quad.browser, school.id);
    clock += 2 * MINUTE_MS;

    const response = await redeem(new Browser(app), token);

    expect(response.statusCode).toBe(400);
    expect(codeOf(response)).toBe('invalid_link');
    expect((await supportRows(school.id))[0]?.redeemed).toBe(false);
    clock = Date.now();
  });

  it('refuses a forged link: a tampered payload, another key or another purpose', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const other = await schoolWithRoles(db());
    const quad = await consoleAs('support');
    const token = await linkFor(quad.browser, school.id);
    const [segment = '', signature = ''] = token.split('.');
    const payload = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const sign = (part: string, key: string) =>
      createHmac('sha256', key).update(part, 'ascii').digest('base64url');
    // School A's link pointed at school B, with A's signature.
    const tampered = `${encode({ ...payload, tid: other.id })}.${signature}`;
    // Signed with a key that is not LINK_SIGNING_SECRET.
    const otherKey = encode({ ...payload, nonce: 'AAAAAAAAAAAAAAAAAAAAAA' });
    const wrongKey = `${otherKey}.${sign(otherKey, 'not-the-link-signing-secret-at-all-000')}`;
    // A correctly signed link for another purpose.
    const secret = env.LINK_SIGNING_SECRET ?? '';
    const reset = encode({
      ...payload,
      purpose: 'password_reset',
      nonce: 'BBBBBBBBBBBBBBBBBBBBBB',
    });
    const wrongPurpose = `${reset}.${sign(reset, secret)}`;

    for (const forged of [tampered, wrongKey, wrongPurpose, 'not-a-link']) {
      const browser = new Browser(app);
      const response = await redeem(browser, forged);
      expect(response.statusCode).toBe(400);
      expect(codeOf(response)).toBe('invalid_link');
      expect(browser.cookies.has('quad_sid')).toBe(false);
    }
    expect(await supportRows(other.id)).toEqual([]);
    // Positive control: the real link still works.
    expect((await redeem(new Browser(app), token)).statusCode).toBe(200);
  });

  it("refuses a correctly signed link whose school is not the visit's, and ends that visit", async () => {
    clock = Date.now();
    const schoolA = await schoolWithRoles(db());
    const schoolB = await schoolWithRoles(db());
    const quad = await consoleAs('support');
    const token = await linkFor(quad.browser, schoolA.id);
    const [segment = ''] = token.split('.');
    const payload = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    // A's visit (`sub`) with B's school (`tid`), signed with the real key and a fresh nonce.
    const mixed = Buffer.from(
      JSON.stringify({ ...payload, tid: schoolB.id, nonce: 'CCCCCCCCCCCCCCCCCCCCCC' }),
    ).toString('base64url');
    const signature = createHmac('sha256', env.LINK_SIGNING_SECRET ?? '')
      .update(mixed, 'ascii')
      .digest('base64url');
    const browser = new Browser(app);

    const response = await redeem(browser, `${mixed}.${signature}`);

    expect(response.statusCode).toBe(400);
    expect(codeOf(response)).toBe('invalid_link');
    expect(response.body).not.toContain(schoolA.name);
    expect(response.body).not.toContain(schoolB.name);
    expect(browser.cookies.has('quad_sid')).toBe(false);
    expect(setCookie(response, 'quad_sid')).toBeUndefined();
    const [visit] = await supportRows(schoolA.id);
    expect(visit?.ended_at).not.toBeNull();
    expect(await supportRows(schoolB.id)).toEqual([]);
    // The real link cannot open the ended visit either.
    expect((await redeem(new Browser(app), token)).statusCode).toBe(400);
  });

  it('answers 400 validation without a token', async () => {
    const response = await new Browser(app).post('/auth/support-session', {});
    expect(response.statusCode).toBe(400);
    expect(codeOf(response)).toBe('validation');
  });
});

describe('a support visit in the school', () => {
  it('acts as the school admin, and each write is one audit_log and one platform_audit row', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const { quad, staff } = await visiting(school.id);
    const [visit] = await supportRows(school.id);
    const current = School.parse((await staff.get('/school')).json());

    const response = await staff.request(
      'PATCH',
      '/school',
      { address: '12 Support Lane, Colombo' },
      { headers: { 'if-match': current.etag } },
    );

    expect(response.statusCode).toBe(200);
    const updates = (await auditEntries(db(), 'settings.updated')).filter(
      (row) => row.tenant_id === school.id,
    );
    expect(updates).toEqual([
      expect.objectContaining({ actor_user_id: null, actor_platform_user_id: quad.id }),
    ]);
    const copies = await db().platform.query<{ actor_platform_user_id: string; meta: unknown }>(
      `select actor_platform_user_id, meta from platform_audit
       where action = 'settings.updated' and tenant_id = $1`,
      [school.id],
    );
    expect(copies.rows).toHaveLength(1);
    expect(copies.rows[0]?.actor_platform_user_id).toBe(quad.id);
    expect(copies.rows[0]?.meta).toMatchObject({ support_session_id: visit?.id });
  });

  it('is refused safeguarding and medical (403), though the admin role would see them', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const { staff } = await visiting(school.id);
    // Positive control: an ordinary admin route answers.
    expect((await staff.get('/probe/guards/fees')).statusCode).toBe(200);
    for (const key of ['medical', 'safeguarding']) {
      const response = await staff.get(`/probe/guards/${key}`);
      expect(response.statusCode).toBe(403);
      expect(codeOf(response)).toBe('forbidden');
    }
    const admin = await staffHolding(db(), school, school.roles.admin);
    expect((await asStaff(app, admin.session)('GET', '/probe/guards/medical')).statusCode).toBe(
      200,
    );
  });

  it('can never grant more than it holds: no role gets safeguarding or medical from it', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const { staff } = await visiting(school.id);
    const created = await staff.post('/roles', {
      name: 'Nurse helper',
      color: '#336699',
      scope: 'school',
      baseRoleKey: null,
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();
    for (const key of ['medical', 'safeguarding']) {
      const response = await staff.request('PUT', `/roles/${id}/permissions`, {
        matrix: {},
        sensitive: [key],
      });
      expect(response.statusCode).toBe(403);
      expect(codeOf(response)).toBe('forbidden');
    }
    // It cannot preview a role or change a person's own settings either: it is nobody's account.
    expect((await staff.request('PATCH', '/me', { theme: 'dark' })).statusCode).toBe(403);
  });

  it("never reaches another school: B's member is 404 and absent from the list", async () => {
    clock = Date.now();
    const a = await schoolWithRoles(db());
    const b = await schoolWithRoles(db());
    const inB = await staffHolding(db(), b, b.roles.teacher);
    const inA = await staffHolding(db(), a, a.roles.teacher);
    const { staff } = await visiting(a.id);

    const byId = await staff.get(`/users/${inB.userId}`);
    expect(byId.statusCode).toBe(404);
    const list = (await staff.get('/users?limit=200')).json<{ items: { id: string }[] }>();
    const ids = list.items.map((item) => item.id);
    expect(ids).toContain(inA.userId);
    expect(ids).not.toContain(inB.userId);
    expect(Me.parse((await staff.get('/me')).json()).school.name).toBe(a.name);
  });

  it('is 401 once its 60 minutes are up', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const { staff } = await visiting(school.id);
    const start = clock;

    clock = start + 59 * MINUTE_MS;
    expect((await staff.get('/me')).statusCode).toBe(200);
    clock = start + 60 * MINUTE_MS;
    expect((await staff.get('/me')).statusCode).toBe(401);
    clock = Date.now();
  });
});

describe('POST /auth/support-session/end (Exit to platform)', () => {
  it('ends the visit, audits it once in the school and once for Quad, clears the cookies and goes to the console', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const { quad, staff } = await visiting(school.id);
    const kept = staff.clone();
    const [visit] = await supportRows(school.id);

    const response = await staff.post('/auth/support-session/end');

    expect(response.statusCode).toBe(200);
    expect(SupportSessionExit.parse(response.json())).toEqual({ redirect: CONSOLE_URL });
    expect(staff.cookies.has('quad_sid')).toBe(false);
    expect(staff.cookies.has('quad_csrf')).toBe(false);
    // The old cookie is dead at once, though the session was cached.
    expect((await kept.get('/me')).statusCode).toBe(401);
    expect((await supportRows(school.id))[0]?.ended_at).not.toBeNull();
    const ended = (await auditEntries(db(), 'support_session.ended')).filter(
      (row) => row.tenant_id === school.id,
    );
    expect(ended).toEqual([
      expect.objectContaining({
        actor_platform_user_id: quad.id,
        target_type: 'support_session',
        target_id: visit?.id,
      }),
    ]);
    expect(await platformAuditRows(db(), 'support_session.ended', visit?.id ?? '')).toHaveLength(1);

    // A second exit (another tab) finds no visit (401) and writes nothing more.
    const again = await kept.post('/auth/support-session/end');
    expect(again.statusCode).toBe(401);
    expect(
      (await auditEntries(db(), 'support_session.ended')).filter(
        (row) => row.tenant_id === school.id,
      ),
    ).toHaveLength(1);
    expect(await platformAuditRows(db(), 'support_session.ended', visit?.id ?? '')).toHaveLength(1);
  });

  it('ends a live visit and writes its school entry together, or neither', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const { staff } = await visiting(school.id);
    const [visit] = await supportRows(school.id);
    // Make the school's audit insert fail for this school only, as a dropped connection would.
    await db().owner.query(`
      create function refuse_ended_audit() returns trigger language plpgsql as $$
      begin
        if new.action = 'support_session.ended' and new.tenant_id = '${school.id}' then
          raise exception 'audit insert refused by the test';
        end if;
        return new;
      end $$;
      create trigger refuse_ended_audit before insert on audit_log
        for each row execute function refuse_ended_audit();
    `);
    try {
      const failed = await staff.clone().post('/auth/support-session/end');
      expect(failed.statusCode).toBe(500);
      // Nothing was ended: no ended_at, no Quad entry, and the visit still works.
      expect((await supportRows(school.id))[0]?.ended_at).toBeNull();
      expect(await platformAuditRows(db(), 'support_session.ended', visit?.id ?? '')).toEqual([]);
      expect((await staff.get('/me')).statusCode).toBe(200);
    } finally {
      await db().owner.query(`
        drop trigger refuse_ended_audit on audit_log;
        drop function refuse_ended_audit();
      `);
    }

    const response = await staff.post('/auth/support-session/end');

    expect(response.statusCode).toBe(200);
    expect((await supportRows(school.id))[0]?.ended_at).not.toBeNull();
    expect(await platformAuditRows(db(), 'support_session.ended', visit?.id ?? '')).toHaveLength(1);
    expect(
      (await auditEntries(db(), 'support_session.ended')).filter(
        (row) => row.tenant_id === school.id,
      ),
    ).toHaveLength(1);
  });

  it('needs the CSRF header (403) and its own cookie (401), and then ends nothing', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const { staff } = await visiting(school.id);

    const withoutCsrf = await staff.post('/auth/support-session/end', undefined, { csrf: false });
    expect(withoutCsrf.statusCode).toBe(403);
    expect(codeOf(withoutCsrf)).toBe('forbidden');
    const withoutCookie = await new Browser(app).post('/auth/support-session/end');
    expect(withoutCookie.statusCode).toBe(401);

    expect((await supportRows(school.id))[0]?.ended_at).toBeNull();
    expect((await staff.get('/me')).statusCode).toBe(200);
  });

  it('still exits cleanly once the 60 minutes are up, ending the visit then', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const { staff } = await visiting(school.id);
    const [visit] = await supportRows(school.id);
    clock += 60 * MINUTE_MS;
    expect((await staff.get('/me')).statusCode).toBe(401);
    // The database's own clock has not moved, so the row only expires in this test's app clock.
    await db().platform.query(
      `update support_sessions set expires_at = now() - interval '1 second' where id = $1`,
      [visit?.id],
    );

    const response = await staff.post('/auth/support-session/end');

    expect(response.statusCode).toBe(200);
    expect(SupportSessionExit.parse(response.json())).toEqual({ redirect: CONSOLE_URL });
    expect(staff.cookies.has('quad_sid')).toBe(false);
    expect((await supportRows(school.id))[0]?.ended_at).not.toBeNull();
    expect(await platformAuditRows(db(), 'support_session.ended', visit?.id ?? '')).toHaveLength(1);
    // The expired visit no longer resolves, so its school entry follows in its own transaction.
    expect(
      (await auditEntries(db(), 'support_session.ended')).filter(
        (row) => row.tenant_id === school.id,
      ),
    ).toEqual([expect.objectContaining({ target_id: visit?.id })]);
    clock = Date.now();
  });

  it('answers 401 to a cookie that names no visit, with a valid CSRF header', async () => {
    const token = newSessionToken();
    const browser = new Browser(app);
    browser.cookies.set('quad_sid', token);
    browser.cookies.set(
      'quad_csrf',
      new CsrfTokens(env.SESSION_SECRET ?? '').tokenFor(hashSessionToken(token)),
    );
    const response = await browser.post('/auth/support-session/end');
    expect(response.statusCode).toBe(401);
  });

  it("a member's own cookie ends no visit: 401, and their session stays", async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    await visiting(school.id);
    const admin = await staffHolding(db(), school, school.roles.admin);
    const response = await asStaff(app, admin.session)('POST', '/auth/support-session/end');
    expect(response.statusCode).toBe(401);
    expect((await supportRows(school.id))[0]?.ended_at).toBeNull();
    expect((await asStaff(app, admin.session)('GET', '/me')).statusCode).toBe(200);
  });

  it('Sign out in a support visit ends it the same way', async () => {
    clock = Date.now();
    const school = await schoolWithRoles(db());
    const { staff } = await visiting(school.id);
    const kept = staff.clone();

    const response = await staff.post('/auth/sign-out');

    expect(response.statusCode).toBe(204);
    expect((await kept.get('/me')).statusCode).toBe(401);
    expect((await supportRows(school.id))[0]?.ended_at).not.toBeNull();
    expect(
      (await auditEntries(db(), 'support_session.ended')).filter(
        (row) => row.tenant_id === school.id,
      ),
    ).toHaveLength(1);
  });
});

describe('GET /platform/tenants', () => {
  it('lists the schools by name with id, short name, status and colour, never deleted ones', async () => {
    const live = await insertSchool(db(), {
      name: 'Aaaa Support Test School',
      shortName: 'AST',
      brandColor: '#1F3A5F',
    });
    const deleted = await insertSchool(db(), { status: 'deleted' });
    const quad = await consoleAs('readonly');

    const response = await quad.browser.get('/platform/tenants?limit=200');

    expect(response.statusCode).toBe(200);
    const list = PlatformTenantList.parse(response.json());
    expect(list.items).toContainEqual({
      id: live.id,
      name: 'Aaaa Support Test School',
      shortName: 'AST',
      status: 'active',
      brandColor: '#1F3A5F',
    });
    expect(list.items.map((item) => item.id)).not.toContain(deleted.id);
    const names = list.items.map((item) => item.name);
    expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y, 'en')));
  });

  it('pages with a cursor, without skipping or repeating a school', async () => {
    for (let index = 0; index < 3; index += 1) await insertSchool(db());
    const quad = await consoleAs('billing');
    const all = PlatformTenantList.parse(
      (await quad.browser.get('/platform/tenants?limit=200')).json(),
    );
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = cursor === null ? '' : `&cursor=${cursor}`;
      const page = PlatformTenantList.parse(
        (await quad.browser.get(`/platform/tenants?limit=2${query}`)).json(),
      );
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor !== null);
    expect(seen).toEqual(all.items.map((item) => item.id));
  });

  it('answers 400 for a bad limit or cursor, and 401 without a console session', async () => {
    const quad = await consoleAs('readonly');
    for (const query of ['limit=201', 'cursor=not-a-cursor']) {
      const response = await quad.browser.get(`/platform/tenants?${query}`);
      expect(response.statusCode).toBe(400);
      expect(codeOf(response)).toBe('validation');
    }
    expect((await consoleBrowser(app).get('/platform/tenants')).statusCode).toBe(401);
    const school = await schoolWithRoles(db());
    const admin = await staffHolding(db(), school, school.roles.admin);
    expect((await asStaff(app, admin.session)('GET', '/platform/tenants')).statusCode).toBe(401);
  });
});
