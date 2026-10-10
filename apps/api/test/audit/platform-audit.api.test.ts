import { PlatformAuditLog, PlatformAuditPeople } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { csvLines, insertAuditRow, insertPlatformAuditRow } from '../helpers/audit';
import { useDatabaseApp } from '../helpers/database-app';
import {
  CONSOLE_SID,
  consoleBrowser,
  insertConsoleSession,
  insertConsoleUser,
  platformAuditRows,
} from '../helpers/platform';
import { asStaff, schoolWithRoles, staffHolding } from '../helpers/users';

import type { Browser } from '../helpers/browser';
import type { PlatformRole } from '@quad/contracts';
import type { LightMyRequestResponse as Response } from 'fastify';

const { db, app } = useDatabaseApp();

/** A console browser signed in as a new console user with `role` (active, or at a sign-in step). */
async function consoleAs(
  role: PlatformRole,
  stage: 'active' | 'two_step' = 'active',
): Promise<{ readonly browser: Browser; readonly id: string; readonly name: string }> {
  const user = await insertConsoleUser(db(), { role });
  const { token } = await insertConsoleSession(db(), user.id, { stage });
  const browser = consoleBrowser(app);
  browser.cookies.set(CONSOLE_SID, token);
  return { browser, id: user.id, name: user.name };
}

/** Two schools, a Quad staff member's rename of A, a support visit's change in B, and a job's entry. */
async function arrange() {
  const a = await schoolWithRoles(db());
  const b = await schoolWithRoles(db());
  const owner = await insertConsoleUser(db(), { role: 'owner', name: 'Ama Perera' });
  const renamed = await insertPlatformAuditRow(db(), {
    action: 'tenant.renamed',
    at: '2026-10-01T09:00:00.000000Z',
    actorPlatformUserId: owner.id,
    tenantId: a.id,
    targetType: 'tenant',
    targetId: a.id,
    meta: { from: 'Old Name', to: a.name },
    ip: '198.51.100.7',
  });
  const supported = await insertPlatformAuditRow(db(), {
    action: 'settings.updated',
    at: '2026-10-02T09:00:00.000000Z',
    actorPlatformUserId: owner.id,
    tenantId: b.id,
    targetType: 'school',
    targetId: b.id,
    meta: { fields: ['address'], support_session_id: '018f6b3a-0000-7000-8000-000000000001' },
  });
  const job = await insertPlatformAuditRow(db(), {
    action: 'support_session.ended',
    at: '2026-10-03T09:00:00.000000Z',
    tenantId: b.id,
    targetType: 'support_session',
  });
  return { a, b, owner, ids: { renamed, supported, job } };
}

const listOf = (response: Response): PlatformAuditLog => {
  expect(response.statusCode).toBe(200);
  return PlatformAuditLog.parse(response.json());
};

/** Only the entries this test arranged (other tests in the file write their own). */
const within = (log: PlatformAuditLog, ids: Record<string, string>) =>
  log.items.filter((item) => Object.values(ids).includes(item.id));

describe('GET /platform/audit', () => {
  it('lists every school’s console entries newest first, with who, the school, a readable line and the support marker', async () => {
    const { a, b, owner, ids } = await arrange();
    const { browser } = await consoleAs('readonly');

    const log = listOf(await browser.get('/platform/audit?limit=200'));

    expect(within(log, ids)).toEqual([
      {
        id: ids.job,
        at: '2026-10-03T09:00:00.000Z',
        action: 'support_session.ended',
        summary: 'The Quad support visit ended',
        actor: { type: 'system' },
        school: { id: b.id, name: b.name },
        viaSupport: false,
        target: { type: 'support_session', id: null },
        meta: {},
        ip: null,
      },
      {
        id: ids.supported,
        at: '2026-10-02T09:00:00.000Z',
        action: 'settings.updated',
        summary: 'Changed School settings: address',
        actor: { type: 'quad', id: owner.id, name: 'Ama Perera' },
        school: { id: b.id, name: b.name },
        viaSupport: true,
        target: { type: 'school', id: b.id },
        meta: { fields: ['address'], support_session_id: '018f6b3a-0000-7000-8000-000000000001' },
        ip: null,
      },
      {
        id: ids.renamed,
        at: '2026-10-01T09:00:00.000Z',
        action: 'tenant.renamed',
        summary: `Renamed the school from “Old Name” to “${a.name}”`,
        actor: { type: 'quad', id: owner.id, name: 'Ama Perera' },
        school: { id: a.id, name: a.name },
        viaSupport: false,
        target: { type: 'tenant', id: a.id },
        meta: { from: 'Old Name', to: a.name },
        ip: '198.51.100.7',
      },
    ]);
  });

  it('filters by Quad staff member, school, action and a from–to range', async () => {
    const { a, b, owner, ids } = await arrange();
    const { browser } = await consoleAs('support');
    const idsOf = async (query: string) =>
      within(listOf(await browser.get(`/platform/audit?${query}`)), ids).map((item) => item.id);

    expect(await idsOf(`actor=${owner.id}`)).toEqual([ids.supported, ids.renamed]);
    expect(await idsOf(`tenantId=${a.id}`)).toEqual([ids.renamed]);
    expect(await idsOf(`tenantId=${b.id}&action=support_session.ended`)).toEqual([ids.job]);
    expect(await idsOf('from=2026-10-02T00:00:00.000Z&to=2026-10-03T00:00:00.000Z')).toEqual([
      ids.supported,
    ]);
  });

  it('pages newest first with a cursor, without skipping entries in the same millisecond', async () => {
    const school = await schoolWithRoles(db());
    const ids: string[] = [];
    for (const micros of ['000001', '000002', '000003']) {
      ids.push(
        await insertPlatformAuditRow(db(), {
          action: 'support_session.started',
          at: `2026-10-05T10:00:00.${micros}Z`,
          tenantId: school.id,
        }),
      );
    }
    const { browser } = await consoleAs('billing');
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = cursor === null ? '' : `&cursor=${cursor}`;
      const page = listOf(
        await browser.get(`/platform/audit?limit=2&tenantId=${school.id}${query}`),
      );
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor !== null);
    expect(seen).toEqual([...ids].reverse());
  });

  it('answers 400 validation for a bad filter, range or cursor', async () => {
    const { browser } = await consoleAs('owner');
    const fieldsOf = async (query: string) => {
      const response = await browser.get(`/platform/audit?${query}`);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'validation' });
      return Object.keys(response.json<{ fields: Record<string, string> }>().fields);
    };
    expect(await fieldsOf('tenantId=school-a')).toEqual(['tenantId']);
    expect(await fieldsOf('actor=someone')).toEqual(['actor']);
    expect(await fieldsOf('action=made.up')).toEqual(['action']);
    expect(await fieldsOf('from=2026-10-08T00:00:00Z&to=2026-10-01T00:00:00Z')).toEqual(['to']);
    expect(await fieldsOf('cursor=nope')).toEqual(['cursor']);
  });

  it('answers 401 without a console session: none, one still at the authenticator step, or a school member’s', async () => {
    expect((await consoleBrowser(app).get('/platform/audit')).statusCode).toBe(401);
    const { browser } = await consoleAs('owner', 'two_step');
    expect((await browser.get('/platform/audit')).statusCode).toBe(401);
    const school = await schoolWithRoles(db());
    const admin = await staffHolding(db(), school, school.roles.admin);
    expect((await asStaff(app, admin.session)('GET', '/platform/audit')).statusCode).toBe(401);
  });

  it('keeps a school’s own log and the console log apart: a school entry not copied by a visit never shows here', async () => {
    const { a } = await arrange();
    const admin = await staffHolding(db(), a, a.roles.admin);
    const own = await insertAuditRow(db(), {
      tenantId: a.id,
      action: 'auth.sign_in',
      at: '2026-10-04T09:00:00.000000Z',
      actorUserId: admin.userId,
    });
    const { browser } = await consoleAs('owner');
    const log = listOf(await browser.get(`/platform/audit?tenantId=${a.id}`));
    expect(log.items.map((item) => item.id)).not.toContain(own);
    // Positive control: the school sees it in its own log.
    const schoolLog = await asStaff(app, admin.session)('GET', '/audit');
    expect(schoolLog.json<{ items: { id: string }[] }>().items.map((item) => item.id)).toEqual([
      own,
    ]);
  });
});

describe('GET /platform/audit varies on Accept', () => {
  it('says so on the JSON page too, so a cache never serves one format for the other', async () => {
    const quad = await consoleAs('readonly');
    const response = await quad.browser.get('/platform/audit');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers.vary).toBe('Accept');
  });
});

describe('GET /platform/audit as CSV', () => {
  it('exports the filtered entries with the school, and records the export in platform_audit', async () => {
    const { a, ids } = await arrange();
    const quad = await consoleAs('readonly');

    const response = await quad.browser.get(`/platform/audit?tenantId=${a.id}`, {
      headers: { accept: 'text/csv' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="quad-platform-audit-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(response.headers['cache-control']).toBe('no-store');
    // One URL, two formats: caches must key on Accept (Task 15 review M3).
    expect(response.headers.vary).toBe('Accept');
    expect(csvLines(response.body)).toEqual([
      'When (UTC),Who,What,School,Quad support visit,IP address,Details',
      `2026-10-01T09:00:00.000Z,Ama Perera,Renamed the school from “Old Name” to “${a.name}”,${a.name},No,198.51.100.7,` +
        `"{""to"":""${a.name}"",""from"":""Old Name""}"`,
    ]);
    expect(ids.renamed).toBeDefined();
    const exported = await platformAuditRows(db(), 'audit.exported', null);
    expect(exported.filter((row) => row.actor_platform_user_id === quad.id)).toEqual([
      expect.objectContaining({
        actor_platform_user_id: quad.id,
        target_type: 'audit_log',
        meta: { filters: { tenantId: a.id }, rows: 1 },
      }),
    ]);
  });

  it('answers 400 for a bad filter and 401 without a console session, exporting nothing', async () => {
    const quad = await consoleAs('owner');
    const bad = await quad.browser.get('/platform/audit?tenantId=x', {
      headers: { accept: 'text/csv' },
    });
    expect(bad.statusCode).toBe(400);
    const none = await consoleBrowser(app).get('/platform/audit', {
      headers: { accept: 'text/csv' },
    });
    expect(none.statusCode).toBe(401);
    const { rows } = await db().platform.query(
      `select 1 from platform_audit where action = 'audit.exported' and actor_platform_user_id = $1`,
      [quad.id],
    );
    expect(rows).toEqual([]);
  });
});

describe('GET /platform/audit/people', () => {
  const peopleOf = async (browser: Browser, query = '') => {
    const response = await browser.get(`/platform/audit/people${query}`);
    expect(response.statusCode).toBe(200);
    return PlatformAuditPeople.parse(response.json()).items;
  };

  it('lists the Quad staff who appear as the actor in the console log, by name, once each', async () => {
    const { owner } = await arrange();
    const zed = await insertConsoleUser(db(), { role: 'support', name: 'Zed Quad Actor' });
    await insertPlatformAuditRow(db(), {
      action: 'auth.sign_in',
      at: '2026-10-04T09:00:00.000000Z',
      actorPlatformUserId: zed.id,
    });
    const idle = await insertConsoleUser(db(), { role: 'support', name: 'Idle Quad Staff' });
    const { browser, id: reader } = await consoleAs('readonly');

    const people = await peopleOf(browser);

    const ids = people.map((person) => person.id);
    expect(ids).toContain(owner.id);
    expect(ids).toContain(zed.id);
    // Never acted (the reader only read): not offered as a filter.
    expect(ids).not.toContain(idle.id);
    expect(ids).not.toContain(reader);
    expect(ids.filter((id) => id === owner.id)).toHaveLength(1);
    expect(people.find((person) => person.id === owner.id)?.name).toBe('Ama Perera');
    const names = people.map((person) => person.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('answers 400 validation for any query, since it takes none', async () => {
    const { browser } = await consoleAs('owner');
    const response = await browser.get('/platform/audit/people?tenantId=x');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });

  it('answers 401 without a console session: none, one still at the authenticator step, or a school member’s', async () => {
    expect((await consoleBrowser(app).get('/platform/audit/people')).statusCode).toBe(401);
    const { browser } = await consoleAs('owner', 'two_step');
    expect((await browser.get('/platform/audit/people')).statusCode).toBe(401);
    const school = await schoolWithRoles(db());
    const admin = await staffHolding(db(), school, school.roles.admin);
    expect((await asStaff(app, admin.session)('GET', '/platform/audit/people')).statusCode).toBe(
      401,
    );
  });

  it('never lists a school’s members, even ones who acted in their school’s log', async () => {
    const { a } = await arrange();
    const admin = await staffHolding(db(), a, a.roles.admin);
    await insertAuditRow(db(), {
      tenantId: a.id,
      action: 'auth.sign_in',
      at: '2026-10-04T09:00:00.000000Z',
      actorUserId: admin.userId,
    });
    const { browser } = await consoleAs('owner');
    const ids = (await peopleOf(browser)).map((person) => person.id);
    expect(ids).not.toContain(admin.userId);
    // Positive control: the school's own person filter lists them.
    const own = await asStaff(app, admin.session)('GET', '/audit/people');
    expect(own.json<{ items: { id: string }[] }>().items.map((item) => item.id)).toContain(
      admin.userId,
    );
  });
});
