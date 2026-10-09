import { randomBytes } from 'node:crypto';

import { MePermissions } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { SessionRepository } from '../../src/common/session/session.repository';
import { TENANT_DB } from '../../src/tokens';
import { RecordingDelivery } from '../fakes/delivery';
import { RecordingOtpSends } from '../fakes/otp-sends';
import {
  assignRole,
  auditEntries,
  insertSystemRole,
  setPlanModules,
  setPreview,
} from '../helpers/access';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import {
  insertMember,
  insertPlatformUser,
  insertSchool,
  insertSupportVisit,
  sessionHeaders,
  signedInMember,
} from '../helpers/identity';
import { bearer, insertParentMember, insertPhoneAccount, signedInParent } from '../helpers/parent';

import type { SchoolSeed, SessionSeed } from '../helpers/identity';
import type { PlanModule } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';

const delivery = new RecordingDelivery();
const otpSends = new RecordingOtpSends(delivery);
const { db, app } = useDatabaseApp({}, { overrides: { delivery, otpSends } });

const EVERY_MODULE: readonly PlanModule[] = [
  'admissions',
  'crm',
  'sis',
  'lms',
  'fees',
  'finance',
  'parent',
  'transport',
];

type Seed = Pick<SessionSeed, 'token' | 'csrf'>;
const as = (session: Seed, options: { readonly csrfHeader?: boolean } = {}) => ({
  get: (url: string) => new Browser(app).get(url, { headers: sessionHeaders(session, options) }),
  start: (body: unknown) =>
    new Browser(app).post('/me/role-preview', body, {
      headers: sessionHeaders(session, options),
    }),
  end: () =>
    new Browser(app).request('DELETE', '/me/role-preview', undefined, {
      headers: sessionHeaders(session, options),
    }),
});

async function school(): Promise<SchoolSeed> {
  const seeded = await insertSchool(db());
  await setPlanModules(db(), seeded.id, EVERY_MODULE);
  return seeded;
}

async function staffAs(at: SchoolSeed, key: string, options: { accountId?: string } = {}) {
  const member = await signedInMember(db(), at, options);
  const roleId = await insertSystemRole(db(), at.id, key, {
    name: key === 'teacher' ? 'Teacher' : key,
    scope: key === 'teacher' ? 'own_classes' : 'school',
  });
  await assignRole(db(), at.id, member.userId, roleId);
  return { ...member, roleId };
}

async function previewColumns(sessionId: string) {
  const { rows } = await db().platform.query<{
    preview_role_id: string | null;
    preview_sample_user_id: string | null;
  }>('select preview_role_id, preview_sample_user_id from sessions where id = $1', [sessionId]);
  return rows[0];
}

describe('POST /me/role-preview', () => {
  it('starts a preview: the role’s permissions, on the next request too, and an audit row', async () => {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    const finance = await insertSystemRole(db(), at.id, 'finance', { name: 'Finance officer' });

    const response = await as(admin.session).start({ roleId: finance });

    expect(response.statusCode).toBe(200);
    const body = MePermissions.parse(response.json());
    expect(body.preview).toEqual({
      roleId: finance,
      roleName: 'Finance officer',
      sampleUser: null,
    });
    expect(body.keys).toContain('fees.approve');
    expect(body.keys).not.toContain('users.manage');
    const next = MePermissions.parse((await as(admin.session).get('/me/permissions')).json());
    expect(next).toEqual(body);
    expect(await previewColumns(admin.session.id)).toEqual({
      preview_role_id: finance,
      preview_sample_user_id: null,
    });
    const rows = (await auditEntries(db(), 'role_preview.started')).filter(
      (row) => row.tenant_id === at.id,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        actor_user_id: admin.userId,
        target_type: 'role',
        target_id: finance,
        meta: { sampleUserId: null },
      }),
    ]);
  });

  it('previews a teacher through a sample class-teacher membership', async () => {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    const teacher = await staffAs(at, 'teacher');
    const sampleUserId = teacher.userId;

    const response = await as(admin.session).start({ roleId: teacher.roleId, sampleUserId });

    expect(response.statusCode).toBe(200);
    const body = MePermissions.parse(response.json());
    expect(body.home).toBe('my_teaching');
    expect(body.preview).toMatchObject({
      roleId: teacher.roleId,
      sampleUser: { id: sampleUserId },
    });
    const me = await as(admin.session).get('/me');
    expect(me.json()).toMatchObject({ preview: { roleName: 'Teacher' } });
  });

  it('answers 400 validation for a malformed body, with the field', async () => {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    for (const [body, field] of [
      [{ roleId: 'teacher' }, 'roleId'],
      [{}, 'roleId'],
      [{ roleId: admin.roleId, sampleUserId: 'someone' }, 'sampleUserId'],
    ] as const) {
      const response = await as(admin.session).start(body);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        code: 'validation',
        fields: { [field]: expect.any(String) as unknown },
      });
    }
    const unknownKey = await as(admin.session).start({ roleId: admin.roleId, tenantId: at.id });
    expect(unknownKey.statusCode).toBe(400);
  });

  it('answers 400 validation when a teacher preview has no sample person', async () => {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    const teacherRole = await insertSystemRole(db(), at.id, 'teacher', { scope: 'own_classes' });

    const response = await as(admin.session).start({ roleId: teacherRole });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'validation',
      fields: { sampleUserId: expect.any(String) as unknown },
    });
    expect(await previewColumns(admin.session.id)).toEqual({
      preview_role_id: null,
      preview_sample_user_id: null,
    });
  });

  it('answers 403 forbidden without users.manage, and to a support visit and a parent token', async () => {
    const at = await school();
    const teacher = await staffAs(at, 'teacher');
    const finance = await insertSystemRole(db(), at.id, 'finance');

    const refused = await as(teacher.session).start({ roleId: finance });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'forbidden' });

    const visit = await insertSupportVisit(db(), await insertPlatformUser(db(), 'Nimal'), at.id);
    const support = await as(visit).start({ roleId: finance });
    expect(support.statusCode).toBe(403);
    expect(support.json()).toMatchObject({ code: 'forbidden' });

    const account = await insertPhoneAccount(db());
    await insertParentMember(db(), at.id, account.id, 'guardian');
    const pair = await signedInParent(app, otpSends, account.phone);
    const parent = await new Browser(app).post(
      '/me/role-preview',
      { roleId: finance },
      { headers: bearer(pair.accessToken) },
    );
    expect(parent.statusCode).toBe(403);
    expect(await auditEntries(db(), 'role_preview.started')).not.toContainEqual(
      expect.objectContaining({ tenant_id: at.id, target_id: finance }),
    );
  });

  it('answers 403 preview_read_only while a preview is already on, and the CSRF 403 without the header', async () => {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    const finance = await insertSystemRole(db(), at.id, 'finance');
    await setPreview(db(), admin.session.id, finance);

    const csrfless = await as(admin.session, { csrfHeader: false }).start({ roleId: finance });
    expect(csrfless.statusCode).toBe(403);
    expect(csrfless.json()).toMatchObject({ code: 'forbidden' });
    const again = await as(admin.session).start({ roleId: finance });
    expect(again.statusCode).toBe(403);
    expect(again.json()).toMatchObject({ code: 'preview_read_only' });
  });

  it("answers 404 for another school's role or sample person, and leaves the session as it was", async () => {
    const a = await school();
    const b = await school();
    const admin = await staffAs(a, 'admin');
    const roleInB = await insertSystemRole(db(), b.id, 'finance');
    const teacherInB = await staffAs(b, 'teacher');
    const teacherRoleInA = await insertSystemRole(db(), a.id, 'teacher', { scope: 'own_classes' });

    const role = await as(admin.session).start({ roleId: roleInB });
    expect(role.statusCode).toBe(404);
    const sample = await as(admin.session).start({
      roleId: teacherRoleInA,
      sampleUserId: teacherInB.userId,
    });
    expect(sample.statusCode).toBe(404);
    expect(await previewColumns(admin.session.id)).toEqual({
      preview_role_id: null,
      preview_sample_user_id: null,
    });
  });

  it('answers 404 for a sample person who is not staff of this school', async () => {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    const teacherRole = await insertSystemRole(db(), at.id, 'teacher', { scope: 'own_classes' });
    const account = await insertPhoneAccount(db());
    const guardian = await insertMember(db(), at.id, account.id, { kind: 'guardian' });

    const response = await as(admin.session).start({ roleId: teacherRole, sampleUserId: guardian });
    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /me/role-preview', () => {
  async function previewing() {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    const finance = await insertSystemRole(db(), at.id, 'finance');
    expect((await as(admin.session).start({ roleId: finance })).statusCode).toBe(200);
    return { at, admin, finance };
  }

  it("ends the preview: back to the admin's own permissions, and an audit row", async () => {
    const { at, admin, finance } = await previewing();

    const response = await as(admin.session).end();

    expect(response.statusCode).toBe(204);
    const body = MePermissions.parse((await as(admin.session).get('/me/permissions')).json());
    expect(body.preview).toBeNull();
    expect(body.keys).toContain('users.manage');
    expect((await as(admin.session).get('/me')).json()).toMatchObject({ preview: null });
    const rows = (await auditEntries(db(), 'role_preview.ended')).filter(
      (row) => row.tenant_id === at.id,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        actor_user_id: admin.userId,
        target_type: 'role',
        target_id: finance,
      }),
    ]);
  });

  it('answers 404 when no preview is on', async () => {
    const at = await school();
    const admin = await staffAs(at, 'admin');
    const response = await as(admin.session).end();
    expect(response.statusCode).toBe(404);
    expect(await auditEntries(db(), 'role_preview.ended')).not.toContainEqual(
      expect.objectContaining({ actor_user_id: admin.userId }),
    );
  });

  it('answers 403 without X-CSRF-Token and keeps the preview, and 403 to a support visit', async () => {
    const { at, admin, finance } = await previewing();
    const response = await as(admin.session, { csrfHeader: false }).end();
    expect(response.statusCode).toBe(403);
    expect((await previewColumns(admin.session.id))?.preview_role_id).toBe(finance);

    const visit = await insertSupportVisit(db(), await insertPlatformUser(db(), 'Nimal'), at.id);
    const support = await as(visit).end();
    expect(support.statusCode).toBe(403);
    expect(support.json()).toMatchObject({ code: 'forbidden' });
  });

  it("ends only this session's preview: the same person's preview in another school stays", async () => {
    const { admin: inA, finance } = await previewing();
    const b = await school();
    const inB = await staffAs(b, 'admin', { accountId: inA.accountId });
    const financeInB = await insertSystemRole(db(), b.id, 'finance');
    expect((await as(inB.session).start({ roleId: financeInB })).statusCode).toBe(200);

    expect((await as(inB.session).end()).statusCode).toBe(204);

    expect((await previewColumns(inA.session.id))?.preview_role_id).toBe(finance);
    expect((await previewColumns(inB.session.id))?.preview_role_id).toBeNull();
  });
});

describe('a preview and Switch school (fix round 1, M6)', () => {
  it('refuses Switch school while previewing (Back to my view comes first)', async () => {
    const a = await school();
    const b = await school();
    const admin = await staffAs(a, 'admin');
    await signedInMember(db(), b, { accountId: admin.accountId });
    const finance = await insertSystemRole(db(), a.id, 'finance');
    await setPreview(db(), admin.session.id, finance);

    const response = await new Browser(app).post(
      '/auth/select-school',
      { tenantId: b.id },
      { headers: sessionHeaders(admin.session) },
    );
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'preview_read_only' });
  });

  it('clears the preview whenever the session rotates to another school (rotateIn)', async () => {
    const a = await school();
    const b = await school();
    const admin = await staffAs(a, 'admin');
    const inB = await signedInMember(db(), b, { accountId: admin.accountId });
    const finance = await insertSystemRole(db(), a.id, 'finance');
    await setPreview(db(), admin.session.id, finance);

    const tenantDb = app().get<QuadTenantDb>(TENANT_DB);
    const rotated = await tenantDb.withAccount(admin.accountId, (tx) =>
      app()
        .get(SessionRepository)
        .rotateIn(tx, admin.session.id, admin.session.tokenHash, {
          stage: 'active',
          tenantId: b.id,
          userId: inB.userId,
          tokenHash: randomBytes(32),
          at: new Date(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        }),
    );

    expect(rotated).toBe(true);
    expect(await previewColumns(admin.session.id)).toEqual({
      preview_role_id: null,
      preview_sample_user_id: null,
    });
  });
});
