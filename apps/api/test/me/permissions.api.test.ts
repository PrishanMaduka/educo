import { MePermissions, STAFF_PAGES } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { RecordingDelivery } from '../fakes/delivery';
import { RecordingOtpSends } from '../fakes/otp-sends';
import {
  assignRole,
  insertCustomRole,
  insertSystemRole,
  setPlanModules,
  setPreview,
} from '../helpers/access';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import {
  insertPlatformUser,
  insertSchool,
  insertSupportVisit,
  sessionHeaders,
  signedInMember,
} from '../helpers/identity';
import { bearer, insertParentMember, insertPhoneAccount, signedInParent } from '../helpers/parent';

import type { SchoolSeed, SessionSeed } from '../helpers/identity';
import type { PlanModule, RoleScope } from '@quad/contracts';

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

const permissionsOf = (session: Pick<SessionSeed, 'token' | 'csrf'>) =>
  new Browser(app).get('/me/permissions', { headers: sessionHeaders(session) });

async function school(modules: readonly PlanModule[] = EVERY_MODULE): Promise<SchoolSeed> {
  const seeded = await insertSchool(db());
  await setPlanModules(db(), seeded.id, modules);
  return seeded;
}

async function staffAs(at: SchoolSeed, key: string, scope: RoleScope = 'school') {
  const member = await signedInMember(db(), at);
  const roleId = await insertSystemRole(db(), at.id, key, { scope });
  await assignRole(db(), at.id, member.userId, roleId);
  return { ...member, roleId };
}

const pageOf = (body: MePermissions, id: string) => body.pages.find((page) => page.id === id);

describe('GET /me/permissions', () => {
  it("returns a school admin's keys, every page in side bar order and the Dashboard as home", async () => {
    const at = await school();
    const admin = await staffAs(at, 'admin');

    const response = await permissionsOf(admin.session);

    expect(response.statusCode).toBe(200);
    const body = MePermissions.parse(response.json());
    expect(body.keys).toEqual(expect.arrayContaining(['users.manage', 'sensitive.safeguarding']));
    expect(body.keys).toEqual([...body.keys].sort());
    expect(body.pages.map((page) => page.id)).toEqual(STAFF_PAGES.map((page) => page.id));
    expect(body.pages.every((page) => page.access === 'full')).toBe(true);
    expect(body.home).toBe('dashboard');
    expect(body.preview).toBeNull();
  });

  it('starts a teacher (own classes) on My teaching, with Timetable view only', async () => {
    const at = await school();
    const teacher = await staffAs(at, 'teacher', 'own_classes');
    const body = MePermissions.parse((await permissionsOf(teacher.session)).json());
    expect(body.home).toBe('my_teaching');
    expect(pageOf(body, 'timetable')?.access).toBe('view_only');
    expect(pageOf(body, 'fees')?.access).toBe('hidden');
    expect(body.keys).not.toContain('users.manage');
  });

  it('hides the pages of modules outside the plan', async () => {
    const at = await school(['sis']);
    const admin = await staffAs(at, 'admin');
    const body = MePermissions.parse((await permissionsOf(admin.session)).json());
    expect(pageOf(body, 'fees')?.access).toBe('hidden');
    expect(body.keys).not.toContain('fees.view');
    expect(pageOf(body, 'students')?.access).toBe('full');
  });

  it("says plan for a page hidden by the school's plan, even for an admin (D52)", async () => {
    const at = await school(['sis']);
    const admin = await staffAs(at, 'admin');
    const body = MePermissions.parse((await permissionsOf(admin.session)).json());
    expect(pageOf(body, 'fees')).toEqual({ id: 'fees', access: 'hidden', hiddenBy: 'plan' });
    expect(pageOf(body, 'students')).toEqual({ id: 'students', access: 'full' });
  });

  it('says role for a page in the plan that the role does not open (D52)', async () => {
    const at = await school();
    const teacher = await staffAs(at, 'teacher', 'own_classes');
    const body = MePermissions.parse((await permissionsOf(teacher.session)).json());
    expect(pageOf(body, 'fees')).toEqual({ id: 'fees', access: 'hidden', hiddenBy: 'role' });
    expect(pageOf(body, 'school_settings')?.hiddenBy).toBe('role');
    expect(pageOf(body, 'courses')?.hiddenBy).toBeUndefined();
  });

  it('says plan when a page is outside both the plan and the role (D52)', async () => {
    const at = await school(['sis', 'lms']);
    const teacher = await staffAs(at, 'teacher', 'own_classes');
    const body = MePermissions.parse((await permissionsOf(teacher.session)).json());
    expect(pageOf(body, 'fees')?.hiddenBy).toBe('plan');
  });

  it("reads each school's own plan: another school's smaller plan never leaks (D52)", async () => {
    const a = await school(EVERY_MODULE);
    const b = await school(['sis']);
    const inA = await staffAs(a, 'teacher', 'own_classes');
    const inB = await signedInMember(db(), b, { accountId: inA.accountId });
    await assignRole(db(), b.id, inB.userId, await insertSystemRole(db(), b.id, 'admin'));

    const bodyA = MePermissions.parse((await permissionsOf(inA.session)).json());
    expect(pageOf(bodyA, 'fees')?.hiddenBy).toBe('role');
    expect(bodyA.pages.some((page) => page.hiddenBy === 'plan')).toBe(false);
    const bodyB = MePermissions.parse((await permissionsOf(inB.session)).json());
    expect(pageOf(bodyB, 'fees')?.hiddenBy).toBe('plan');
    expect(pageOf(bodyB, 'courses')?.hiddenBy).toBe('plan');
  });

  it('reflects an active preview: the previewed role, and only keys the admin holds', async () => {
    const at = await school();
    const lead = await signedInMember(db(), at);
    const own = await insertCustomRole(db(), at.id, {
      matrix: { settings: '11111' },
      sensitive: ['export_data'],
    });
    await assignRole(db(), at.id, lead.userId, own);
    const previewed = await insertCustomRole(db(), at.id, {
      name: 'Bursar',
      matrix: { fees: '11000' },
      sensitive: ['export_data', 'medical'],
    });
    await setPreview(db(), lead.session.id, previewed);

    const body = MePermissions.parse((await permissionsOf(lead.session)).json());

    expect(body.keys).toEqual(['fees.create', 'fees.view', 'sensitive.export_data']);
    expect(body.preview).toEqual({ roleId: previewed, roleName: 'Bursar', sampleUser: null });
    expect(pageOf(body, 'fees')?.access).toBe('full');
    expect(pageOf(body, 'school_settings')?.access).toBe('hidden');
  });

  it('gives a support visit the admin set without safeguarding or medical', async () => {
    const at = await school();
    const staff = await insertPlatformUser(db(), 'Nimal from Quad');
    const visit = await insertSupportVisit(db(), staff, at.id);
    const body = MePermissions.parse((await permissionsOf(visit)).json());
    expect(body.keys).toContain('users.manage');
    expect(body.keys).toContain('sensitive.export_data');
    expect(body.keys).not.toContain('sensitive.safeguarding');
    expect(body.keys).not.toContain('sensitive.medical');
  });

  it('answers 401 without a session', async () => {
    expect((await new Browser(app).get('/me/permissions')).statusCode).toBe(401);
  });

  it("answers 403 to a parent's token: staff permissions are for the staff portal", async () => {
    const at = await school();
    const account = await insertPhoneAccount(db());
    await insertParentMember(db(), at.id, account.id, 'guardian');
    const pair = await signedInParent(app, otpSends, account.phone);
    const response = await new Browser(app).get('/me/permissions', {
      headers: bearer(pair.accessToken),
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
  });

  it("shows only the session's own school's roles, for the same person in two schools", async () => {
    const a = await school();
    const b = await school();
    const inA = await staffAs(a, 'admin');
    const inB = await signedInMember(db(), b, { accountId: inA.accountId });
    await assignRole(
      db(),
      b.id,
      inB.userId,
      await insertCustomRole(db(), b.id, { matrix: { crm: '10000' } }),
    );

    const bodyB = MePermissions.parse((await permissionsOf(inB.session)).json());
    expect(bodyB.keys).toEqual(['crm.view']);
    const bodyA = MePermissions.parse((await permissionsOf(inA.session)).json());
    expect(bodyA.keys).toContain('users.manage');
  });
});
