import { ErrorBodySchema, Me, SessionSummaryList } from '@quad/contracts';
import { greetingPeriod } from '@quad/domain';
import { deriveBrand } from '@quad/tokens';
import { describe, expect, it } from 'vitest';

import { useDatabaseApp } from '../helpers/database-app';
import {
  insertAccount,
  insertMember,
  insertPlatformUser,
  insertRole,
  insertSchool,
  insertSupportVisit,
  insertWebSession,
  sessionHeaders,
  signedInMember,
} from '../helpers/identity';

/** The app's fixed clock, so the greeting is known. */
const NOW = Date.UTC(2026, 9, 8, 3, 30); // 09:00 in Colombo

const { db, app } = useDatabaseApp({}, { overrides: { now: () => NOW } });

const inject = (
  method: 'GET' | 'PATCH' | 'DELETE',
  url: string,
  headers: Record<string, string>,
  body?: unknown,
) =>
  app()
    .getHttpAdapter()
    .getInstance()
    .inject({
      method,
      url: `/api/v1${url}`,
      headers: body === undefined ? headers : { ...headers, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
    });

describe('GET /me', () => {
  it('returns the person, their school and brand, their other schools and the greeting', async () => {
    const school = await insertSchool(db(), {
      name: 'Colombo International School',
      shortName: 'CIS',
      brandColor: '#1F6F5C',
    });
    const other = await insertSchool(db(), { name: 'Kandy Hills College', shortName: 'KHC' });
    const guardianSchool = await insertSchool(db());
    const { accountId, userId, session } = await signedInMember(db(), school, {
      name: 'Prishan Maduka',
    });
    const inOther = await insertMember(db(), other.id, accountId, { name: 'Prishan Maduka' });
    await insertRole(db(), other.id, inOther, 'Teacher');
    await insertMember(db(), guardianSchool.id, accountId, { kind: 'guardian' });
    await insertRole(db(), school.id, userId, 'School admin');

    const response = await inject('GET', '/me', sessionHeaders(session));

    expect(response.statusCode).toBe(200);
    const me = Me.parse(response.json());
    expect(me).toEqual({
      person: { name: 'Prishan Maduka', firstName: 'Prishan', theme: 'system', locale: 'en-LK' },
      school: {
        id: school.id,
        name: 'Colombo International School',
        shortName: 'CIS',
        timeZone: 'Asia/Colombo',
        brand: {
          color: '#1F6F5C',
          fill: deriveBrand('#1F6F5C', 'light').brandFill,
          fillDark: deriveBrand('#1F6F5C', 'dark').brandFill,
          ink: deriveBrand('#1F6F5C', 'light').brandInk,
        },
      },
      // Staff memberships of other schools only: not this one, not the guardian one.
      memberships: [
        {
          tenantId: other.id,
          name: 'Kandy Hills College',
          shortName: 'KHC',
          brandColor: null,
          roleNames: ['Teacher'],
          suspended: false,
        },
      ],
      preview: null,
      support: null,
      greeting: greetingPeriod(new Date(NOW), 'Asia/Colombo'),
    });
    expect(me.greeting).toEqual({ period: 'morning', word: 'Good morning' });
  });

  it("gives a school with no brand colour Quad's default brand", async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    const me = Me.parse((await inject('GET', '/me', sessionHeaders(session))).json());
    expect(me.school.brand.fill).toBe(deriveBrand(me.school.brand.color, 'light').brandFill);
  });

  it('answers 401 unauthorized without a session', async () => {
    const response = await inject('GET', '/me', {});
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'unauthorized' });
  });

  it('never shows school A to a session in school B, even for the same person', async () => {
    const schoolA = await insertSchool(db(), { name: 'School A' });
    const schoolB = await insertSchool(db(), { name: 'School B' });
    const inA = await signedInMember(db(), schoolA, { name: 'Name in A' });
    const outsider = await signedInMember(db(), schoolB, { name: 'Outsider in B' });
    const inB = await signedInMember(db(), schoolB, {
      accountId: inA.accountId,
      name: 'Name in B',
    });

    const outsiderMe = Me.parse(
      (await inject('GET', '/me', sessionHeaders(outsider.session))).json(),
    );
    expect(JSON.stringify(outsiderMe)).not.toContain(schoolA.id);
    expect(JSON.stringify(outsiderMe)).not.toContain('School A');

    const me = Me.parse((await inject('GET', '/me', sessionHeaders(inB.session))).json());
    expect(me.school.id).toBe(schoolB.id);
    expect(me.person.name).toBe('Name in B');
    // School A appears only as a school to switch to, never with A's data.
    expect(me.memberships.map((membership) => membership.tenantId)).toEqual([schoolA.id]);
  });

  it('in a support visit, names the Quad staff member and has no other schools', async () => {
    const school = await insertSchool(db(), { name: 'Colombo International School' });
    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    const visit = await insertSupportVisit(db(), staff, school.id);
    const me = Me.parse((await inject('GET', '/me', sessionHeaders(visit))).json());
    expect(me.person).toMatchObject({ name: 'Ruwan Mendis', firstName: 'Ruwan' });
    expect(me.support).toEqual({
      schoolName: 'Colombo International School',
      platformUserName: 'Ruwan Mendis',
    });
    expect(me.memberships).toEqual([]);
  });
});

describe('PATCH /me', () => {
  it('changes the name, theme and locale, and returns the updated person', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school, { name: 'Prishan Maduka' });
    const response = await inject('PATCH', '/me', sessionHeaders(session), {
      name: '  Prishan M. Maduka ',
      theme: 'dark',
      locale: 'si-LK',
    });
    expect(response.statusCode).toBe(200);
    expect(Me.parse(response.json()).person).toEqual({
      name: 'Prishan M. Maduka',
      firstName: 'Prishan',
      theme: 'dark',
      locale: 'si-LK',
    });
    // A null locale goes back to the school's.
    const reset = await inject('PATCH', '/me', sessionHeaders(session), { locale: null });
    expect(Me.parse(reset.json()).person.locale).toBe('en-LK');
  });

  it('answers 400 validation for an unknown theme, with the field', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    const response = await inject('PATCH', '/me', sessionHeaders(session), { theme: 'sepia' });
    expect(response.statusCode).toBe(400);
    const body = ErrorBodySchema.parse(response.json());
    expect(body.code).toBe('validation');
    expect(body.fields).toHaveProperty('theme');
  });

  it('answers 403 without the CSRF header, and 403 in a support visit', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    const noCsrf = await inject('PATCH', '/me', sessionHeaders(session, { csrfHeader: false }), {
      theme: 'dark',
    });
    expect(noCsrf.statusCode).toBe(403);
    expect(noCsrf.json()).toMatchObject({ code: 'forbidden' });

    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    const visit = await insertSupportVisit(db(), staff, school.id);
    const support = await inject('PATCH', '/me', sessionHeaders(visit), { theme: 'dark' });
    expect(support.statusCode).toBe(403);
  });

  it("changes only the current school's membership of the same person", async () => {
    const schoolA = await insertSchool(db());
    const schoolB = await insertSchool(db());
    const inA = await signedInMember(db(), schoolA, { name: 'Same Person' });
    const inB = await signedInMember(db(), schoolB, {
      accountId: inA.accountId,
      name: 'Same Person',
    });

    const response = await inject('PATCH', '/me', sessionHeaders(inA.session), {
      name: 'Renamed in A',
      theme: 'dark',
    });
    expect(response.statusCode).toBe(200);
    expect(Me.parse(response.json()).school.id).toBe(schoolA.id);

    const { rows } = await db().platform.query<{ id: string; name: string; theme: string }>(
      'select id, name, theme from users where account_id = $1 order by name',
      [inA.accountId],
    );
    expect(rows).toEqual([
      { id: inA.userId, name: 'Renamed in A', theme: 'dark' },
      { id: inB.userId, name: 'Same Person', theme: 'system' },
    ]);
  });
});

describe('GET /me/sessions', () => {
  it("lists the person's own live sessions, newest first, marking this one", async () => {
    const school = await insertSchool(db());
    const { accountId, userId, session } = await signedInMember(db(), school);
    const phone = await insertWebSession(db(), accountId, {
      tenantId: school.id,
      userId,
      userAgent: 'Quad test browser',
    });
    await insertWebSession(db(), accountId, { revokedAt: new Date(NOW) });
    await insertWebSession(db(), accountId, { expiresAt: new Date(NOW - 1000) });

    const response = await inject('GET', '/me/sessions', sessionHeaders(session));

    expect(response.statusCode).toBe(200);
    const list = SessionSummaryList.parse(response.json());
    expect(list.items.map((item) => [item.id, item.current, item.userAgent])).toEqual([
      [phone.id, false, 'Quad test browser'],
      [session.id, true, null],
    ]);
    expect(list.nextCursor).toBeNull();
  });

  it('pages with ?limit= and the cursor it returns', async () => {
    const school = await insertSchool(db());
    const { accountId, session } = await signedInMember(db(), school);
    const second = await insertWebSession(db(), accountId);
    const third = await insertWebSession(db(), accountId);
    const first = SessionSummaryList.parse(
      (await inject('GET', '/me/sessions?limit=2', sessionHeaders(session))).json(),
    );
    expect(first.items.map((item) => item.id)).toEqual([third.id, second.id]);
    expect(first.nextCursor).not.toBeNull();
    const next = SessionSummaryList.parse(
      (
        await inject(
          'GET',
          `/me/sessions?limit=2&cursor=${first.nextCursor ?? ''}`,
          sessionHeaders(session),
        )
      ).json(),
    );
    expect(next).toEqual({
      items: [expect.objectContaining({ id: session.id })],
      nextCursor: null,
    });
  });

  it('answers 400 validation for a limit over 200 or a broken cursor', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    for (const query of ['limit=201', 'cursor=not-a-cursor']) {
      const response = await inject('GET', `/me/sessions?${query}`, sessionHeaders(session));
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'validation' });
    }
  });

  it("never lists another account's sessions, in the same school or another", async () => {
    const school = await insertSchool(db());
    const me = await signedInMember(db(), school);
    const colleague = await signedInMember(db(), school);
    const elsewhere = await signedInMember(db(), await insertSchool(db()));
    const list = SessionSummaryList.parse(
      (await inject('GET', '/me/sessions', sessionHeaders(me.session))).json(),
    );
    const ids = list.items.map((item) => item.id);
    expect(ids).toEqual([me.session.id]);
    expect(ids).not.toContain(colleague.session.id);
    expect(ids).not.toContain(elsewhere.session.id);
  });

  it('answers 403 in a support visit, which has no devices of its own', async () => {
    const school = await insertSchool(db());
    const staff = await insertPlatformUser(db(), 'Ruwan Mendis');
    const visit = await insertSupportVisit(db(), staff, school.id);
    expect((await inject('GET', '/me/sessions', sessionHeaders(visit))).statusCode).toBe(403);
  });
});

describe('DELETE /me/sessions/:id', () => {
  it('signs one of your devices out: 204, then that session is 401', async () => {
    const school = await insertSchool(db());
    const { accountId, userId, session } = await signedInMember(db(), school);
    const laptop = await insertWebSession(db(), accountId, { tenantId: school.id, userId });
    const response = await inject('DELETE', `/me/sessions/${laptop.id}`, sessionHeaders(session));
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect((await inject('GET', '/me', sessionHeaders(laptop))).statusCode).toBe(401);
    expect((await inject('GET', '/me', sessionHeaders(session))).statusCode).toBe(200);
  });

  it('clears the cookies when you sign this device out', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    const response = await inject('DELETE', `/me/sessions/${session.id}`, sessionHeaders(session));
    expect(response.statusCode).toBe(204);
    const cleared = response.cookies.map((cookie) => [cookie.name, cookie.value]);
    expect(cleared).toEqual([
      ['quad_sid', ''],
      ['quad_csrf', ''],
    ]);
  });

  it('answers 400 validation for an id that is not a uuid', async () => {
    const school = await insertSchool(db());
    const { session } = await signedInMember(db(), school);
    const response = await inject('DELETE', '/me/sessions/abc', sessionHeaders(session));
    expect(response.statusCode).toBe(400);
    const body = ErrorBodySchema.parse(response.json());
    expect(body.code).toBe('validation');
    expect(body.fields).toHaveProperty('id');
  });

  it('answers 403 without the CSRF header, and signs nothing out', async () => {
    const school = await insertSchool(db());
    const { accountId, session } = await signedInMember(db(), school);
    const laptop = await insertWebSession(db(), accountId);
    const response = await inject(
      'DELETE',
      `/me/sessions/${laptop.id}`,
      sessionHeaders(session, { csrfHeader: false }),
    );
    expect(response.statusCode).toBe(403);
    const { rows } = await db().platform.query('select revoked_at from sessions where id = $1', [
      laptop.id,
    ]);
    expect(rows).toEqual([{ revoked_at: null }]);
  });

  it("answers 404 for another account's session id, and leaves it signed in", async () => {
    const school = await insertSchool(db());
    const me = await signedInMember(db(), school);
    const colleague = await signedInMember(db(), school);
    const other = await insertAccount(db());
    const stranger = await insertWebSession(db(), other);
    for (const id of [colleague.session.id, stranger.id]) {
      const response = await inject('DELETE', `/me/sessions/${id}`, sessionHeaders(me.session));
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: 'not_found' });
    }
    expect((await inject('GET', '/me', sessionHeaders(colleague.session))).statusCode).toBe(200);
  });
});
