import { AuditLog } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { auditEntries, setPreview } from '../helpers/access';
import { csvLines, insertAuditRow, insertManyAuditRows } from '../helpers/audit';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertPlatformUser, insertSupportVisit } from '../helpers/identity';
import { asStaff, schoolWithRoles, staffHolding } from '../helpers/users';

import type { RolesSchool, StaffSeed } from '../helpers/users';
import type { LightMyRequestResponse as Response } from 'fastify';

const { db, app } = useDatabaseApp();

const as = (member: Pick<StaffSeed, 'session'>) => asStaff(app, member.session);

/** A school with an admin (export_data), a principal (settings.view only) and a teacher. */
async function arrange() {
  const school = await schoolWithRoles(db());
  const admin = await staffHolding(db(), school, school.roles.admin, { name: 'Prishan Maduka' });
  const principal = await staffHolding(db(), school, school.roles.principal);
  const teacher = await staffHolding(db(), school, school.roles.teacher, {
    name: 'Nadeesha Jayasinghe',
  });
  return { school, admin, principal, teacher };
}

/** Three entries of `school`: an invite, a support visit's change and a sign-in, oldest first. */
async function history(
  school: RolesSchool,
  admin: StaffSeed,
  teacher: StaffSeed,
): Promise<{ readonly invited: string; readonly supported: string; readonly signedIn: string }> {
  const quad = await insertPlatformUser(db(), 'Quad Support');
  const visit = await insertSupportVisit(db(), quad, school.id);
  const invited = await insertAuditRow(db(), {
    tenantId: school.id,
    action: 'user.invited',
    at: '2026-10-01T09:00:00.000000Z',
    actorUserId: admin.userId,
    targetType: 'user',
    targetId: teacher.userId,
    meta: { resent: false },
    ip: '203.0.113.8',
  });
  const supported = await insertAuditRow(db(), {
    tenantId: school.id,
    action: 'settings.updated',
    at: '2026-10-02T09:00:00.000000Z',
    actorPlatformUserId: quad,
    supportSessionId: visit.id,
    targetType: 'school',
    targetId: school.id,
    meta: { fields: ['address'], before: { address: null }, after: { address: 'Kandy' } },
  });
  const signedIn = await insertAuditRow(db(), {
    tenantId: school.id,
    action: 'auth.sign_in',
    at: '2026-10-03T09:00:00.000000Z',
    actorUserId: teacher.userId,
    targetType: 'session',
  });
  return { invited, supported, signedIn };
}

const listOf = (response: Response): AuditLog => {
  expect(response.statusCode).toBe(200);
  return AuditLog.parse(response.json());
};

const exportsIn = async (school: RolesSchool) =>
  (await auditEntries(db(), 'audit.exported')).filter((row) => row.tenant_id === school.id);

describe('GET /audit', () => {
  it('lists the school’s entries newest first, each with a readable line, who did it and the support marker', async () => {
    const { school, admin, teacher } = await arrange();
    const ids = await history(school, admin, teacher);

    const page = listOf(await as(admin)('GET', '/audit'));

    expect(page.nextCursor).toBeNull();
    expect(page.items).toEqual([
      {
        id: ids.signedIn,
        at: '2026-10-03T09:00:00.000Z',
        action: 'auth.sign_in',
        summary: 'Signed in',
        actor: { type: 'member', id: teacher.userId, name: 'Nadeesha Jayasinghe' },
        viaSupport: false,
        target: { type: 'session', id: null },
        meta: {},
        ip: null,
      },
      {
        id: ids.supported,
        at: '2026-10-02T09:00:00.000Z',
        action: 'settings.updated',
        summary: 'Changed School settings: address',
        actor: { type: 'quad_support' },
        viaSupport: true,
        target: { type: 'school', id: school.id },
        meta: { fields: ['address'], before: { address: null }, after: { address: 'Kandy' } },
        ip: null,
      },
      {
        id: ids.invited,
        at: '2026-10-01T09:00:00.000Z',
        action: 'user.invited',
        summary: 'Invited Nadeesha Jayasinghe',
        actor: { type: 'member', id: admin.userId, name: 'Prishan Maduka' },
        viaSupport: false,
        target: { type: 'user', id: teacher.userId },
        meta: { resent: false },
        ip: '203.0.113.8',
      },
    ]);
  });

  it('filters by person, action and a from–to range (from inclusive, to exclusive)', async () => {
    const { school, admin, teacher } = await arrange();
    const ids = await history(school, admin, teacher);
    const idsOf = async (query: string) =>
      listOf(await as(admin)('GET', `/audit?${query}`)).items.map((item) => item.id);

    expect(await idsOf(`actor=${teacher.userId}`)).toEqual([ids.signedIn]);
    expect(await idsOf('action=user.invited')).toEqual([ids.invited]);
    expect(await idsOf('from=2026-10-02T09:00:00.000Z&to=2026-10-03T09:00:00.000Z')).toEqual([
      ids.supported,
    ]);
    expect(await idsOf(`actor=${admin.userId}&action=auth.sign_in`)).toEqual([]);
  });

  it('pages newest first without skipping or repeating entries in the same millisecond', async () => {
    const { school, admin } = await arrange();
    const ids: string[] = [];
    for (const micros of ['000001', '000002', '000003', '000004', '000005']) {
      ids.push(
        await insertAuditRow(db(), {
          tenantId: school.id,
          action: 'auth.sign_in',
          at: `2026-10-05T10:00:00.${micros}Z`,
          actorUserId: admin.userId,
        }),
      );
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = cursor === null ? '' : `&cursor=${cursor}`;
      const page = listOf(await as(admin)('GET', `/audit?limit=2${query}`));
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor !== null);

    expect(seen).toEqual([...ids].reverse());
  });

  it('answers 400 validation for a bad filter, range, page size or cursor', async () => {
    const { admin } = await arrange();
    const fieldsOf = async (query: string) => {
      const response = await as(admin)('GET', `/audit?${query}`);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'validation' });
      return Object.keys(response.json<{ fields: Record<string, string> }>().fields);
    };
    expect(await fieldsOf('action=made.up')).toEqual(['action']);
    expect(await fieldsOf('action=tenant.renamed')).toEqual(['action']);
    expect(await fieldsOf('actor=someone')).toEqual(['actor']);
    expect(await fieldsOf('from=2026-10-01')).toEqual(['from']);
    expect(await fieldsOf('from=2026-10-08T00:00:00Z&to=2026-10-01T00:00:00Z')).toEqual(['to']);
    expect(await fieldsOf('limit=500')).toEqual(['limit']);
    expect(await fieldsOf('cursor=not-a-cursor')).toEqual(['cursor']);
  });

  it('answers 401 without a session and 403 forbidden to a teacher (no settings.view)', async () => {
    const { teacher } = await arrange();
    expect((await new Browser(app).get('/audit')).statusCode).toBe(401);
    const response = await as(teacher)('GET', '/audit');
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
  });

  it('lets a principal (settings.view) read it, and Quad support in a visit', async () => {
    const { school, principal } = await arrange();
    expect((await as(principal)('GET', '/audit')).statusCode).toBe(200);
    const quad = await insertPlatformUser(db(), 'Quad Support');
    const visit = await insertSupportVisit(db(), quad, school.id);
    expect((await asStaff(app, visit)('GET', '/audit')).statusCode).toBe(200);
  });

  it("never shows school B's entries to school A, even filtered by B's member or for the same person", async () => {
    const a = await arrange();
    const b = await arrange();
    const inB = await history(b.school, b.admin, b.teacher);
    // The same person as A's admin, also an admin in B.
    const sameInB = await staffHolding(db(), b.school, b.school.roles.admin, {
      accountId: a.admin.accountId,
    });
    const own = await insertAuditRow(db(), {
      tenantId: a.school.id,
      action: 'auth.sign_in',
      at: '2026-10-04T09:00:00.000000Z',
      actorUserId: a.admin.userId,
    });

    const fromA = listOf(await as(a.admin)('GET', `/audit?tenantId=${b.school.id}`));
    expect(fromA.items.map((item) => item.id)).toEqual([own]);
    expect(listOf(await as(a.admin)('GET', `/audit?actor=${b.teacher.userId}`)).items).toEqual([]);

    // Positive control: B sees its own entries, and not A's.
    const fromB = listOf(await as(sameInB)('GET', '/audit'));
    expect(fromB.items.map((item) => item.id)).toEqual([inB.signedIn, inB.supported, inB.invited]);
  });

  it('never lists console-only entries such as a rename by Quad', async () => {
    const { school, admin } = await arrange();
    await db().platform.query(
      `insert into platform_audit (action, target_type, target_id, tenant_id, meta)
       values ('tenant.renamed', 'tenant', $1, $1, '{}'::jsonb)`,
      [school.id],
    );
    expect(listOf(await as(admin)('GET', '/audit')).items).toEqual([]);
  });
});

describe('GET /audit as CSV (Accept: text/csv)', () => {
  const csv = (member: StaffSeed, query = '') =>
    as(member)('GET', `/audit${query}`, undefined, { accept: 'text/csv' });

  it('exports the filtered entries as a dated attachment, and audits the export', async () => {
    const { school, admin, teacher } = await arrange();
    await history(school, admin, teacher);

    const response = await csv(admin, '?from=2026-10-01T00:00:00.000Z&to=2026-10-03T00:00:00.000Z');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="quad-audit-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(response.headers['cache-control']).toBe('no-store');
    expect(csvLines(response.body)).toEqual([
      'When (UTC),Who,What,Quad support visit,IP address,Details',
      '2026-10-02T09:00:00.000Z,Quad support,Changed School settings: address,Yes,,' +
        '"{""after"":{""address"":""Kandy""},""before"":{""address"":null},""fields"":[""address""]}"',
      '2026-10-01T09:00:00.000Z,Prishan Maduka,Invited Nadeesha Jayasinghe,No,203.0.113.8,' +
        '"{""resent"":false}"',
    ]);
    expect(await exportsIn(school)).toEqual([
      expect.objectContaining({
        actor_user_id: admin.userId,
        target_type: 'audit_log',
        target_id: null,
        meta: {
          filters: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-03T00:00:00.000Z' },
          rows: 2,
        },
      }),
    ]);
    // The export shows in the log itself, newest first.
    expect(listOf(await as(admin)('GET', '/audit')).items[0]).toMatchObject({
      action: 'audit.exported',
      summary: 'Exported the audit log (2 entries)',
    });
  });

  it('answers 403 without sensitive.export_data (a principal, or an admin previewing one), and audits nothing', async () => {
    const { school, admin, principal } = await arrange();
    const refused = await csv(principal);
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({
      code: 'forbidden',
      message: 'Exporting needs the Export data permission. Ask a school admin.',
    });
    // The admin's session is first used after the preview is set (the session cache).
    await setPreview(db(), admin.session.id, school.roles.principal);
    expect((await csv(admin)).statusCode).toBe(403);
    expect(await exportsIn(school)).toEqual([]);
    // Positive control: another admin, not previewing, exports.
    const other = await staffHolding(db(), school, school.roles.admin);
    expect((await csv(other)).statusCode).toBe(200);
    expect(await exportsIn(school)).toHaveLength(1);
  });

  it('answers 403 to a teacher (no settings.view) before anything else', async () => {
    const { teacher } = await arrange();
    const response = await csv(teacher);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
  });

  it('answers 400 for a bad filter, as the list does', async () => {
    const { school, admin } = await arrange();
    expect((await csv(admin, '?action=made.up')).statusCode).toBe(400);
    expect(await exportsIn(school)).toEqual([]);
  });

  it("exports only the session's school", async () => {
    const a = await arrange();
    const b = await arrange();
    await history(b.school, b.admin, b.teacher);
    const response = await csv(a.admin, `?tenantId=${b.school.id}`);
    expect(response.statusCode).toBe(200);
    expect(csvLines(response.body)).toHaveLength(1);
    expect(await exportsIn(b.school)).toEqual([]);
  });

  it('refuses more than 10,000 entries with 422, asking for a shorter range', async () => {
    const { school, admin } = await arrange();
    await insertManyAuditRows(db(), school.id, 10_001, '2026-09-01T00:00:00Z');
    const response = await csv(admin);
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: 'business_rule',
      message:
        'There are more than 10,000 entries to export. Choose a shorter date range and export again.',
    });
    expect(await exportsIn(school)).toEqual([]);
    // Positive control: a narrower range exports.
    const narrower = await csv(admin, '?to=2026-09-01T00:00:00.000005Z');
    expect(narrower.statusCode).toBe(200);
    expect(csvLines(narrower.body)).toHaveLength(5);
  });

  it('is audited as Quad support, in both logs, in a support visit', async () => {
    const { school } = await arrange();
    const quad = await insertPlatformUser(db(), 'Quad Support');
    const visit = await insertSupportVisit(db(), quad, school.id);
    const response = await asStaff(app, visit)('GET', '/audit', undefined, { accept: 'text/csv' });
    expect(response.statusCode).toBe(200);
    expect(await exportsIn(school)).toEqual([
      expect.objectContaining({ actor_user_id: null, actor_platform_user_id: quad }),
    ]);
    const { rows } = await db().platform.query(
      `select 1 from platform_audit where action = 'audit.exported' and tenant_id = $1`,
      [school.id],
    );
    expect(rows).toHaveLength(1);
  });
});
