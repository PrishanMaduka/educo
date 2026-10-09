import { School, SchoolBranding, SchoolSettings } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { brandPalette } from '../../src/common/branding/brand-palette';
import { auditEntries, setPreview, suspendSchool } from '../helpers/access';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertPlatformUser, insertSupportVisit } from '../helpers/identity';
import { setSignInRules } from '../helpers/sign-in';
import { asStaff, schoolWithRoles, staffHolding } from '../helpers/users';

import type { RolesSchool, StaffSeed } from '../helpers/users';
import type { LightMyRequestResponse as Response } from 'fastify';

const { db, app } = useDatabaseApp();

const as = (member: Pick<StaffSeed, 'session'>) => asStaff(app, member.session);

/** A school with an admin, a principal (settings view only) and a teacher (no settings). */
async function arrange(options: { readonly country?: string } = {}) {
  const school = await schoolWithRoles(db());
  if (options.country !== undefined) {
    await db().platform.query('update tenants set country = $2 where id = $1', [
      school.id,
      options.country,
    ]);
  }
  const admin = await staffHolding(db(), school, school.roles.admin, { name: 'Prishan Maduka' });
  const principal = await staffHolding(db(), school, school.roles.principal);
  const teacher = await staffHolding(db(), school, school.roles.teacher);
  return { school, admin, principal, teacher };
}

async function schoolOf(member: StaffSeed): Promise<School> {
  const response = await as(member)('GET', '/school');
  expect(response.statusCode).toBe(200);
  return School.parse(response.json());
}

/** `PATCH /school` with the version last read (or `etag`). */
async function patch(member: StaffSeed, body: unknown, etag?: string): Promise<Response> {
  const ifMatch = etag ?? (await schoolOf(member)).etag;
  return as(member)('PATCH', '/school', body, { 'if-match': ifMatch });
}

async function settingsRow(tenantId: string) {
  const { rows } = await db().platform.query<{
    office_email: string | null;
    office_phone: string | null;
    address: string | null;
    sms_sender_id: string | null;
    sms_sender_status: string | null;
    updated_by: string | null;
  }>(
    `select office_email, office_phone, address, sms_sender_id, sms_sender_status, updated_by
     from school_settings where tenant_id = $1`,
    [tenantId],
  );
  return rows[0];
}

async function tenantName(tenantId: string): Promise<string | undefined> {
  const { rows } = await db().platform.query<{ name: string }>(
    'select name from tenants where id = $1',
    [tenantId],
  );
  return rows[0]?.name;
}

/** The General values of a school nobody has changed (GET makes the defaults row on first read). */
const UNTOUCHED = {
  office_email: null,
  office_phone: null,
  address: null,
  sms_sender_id: null,
  updated_by: null,
};

const updatesIn = async (school: RolesSchool) =>
  (await auditEntries(db(), 'settings.updated')).filter((row) => row.tenant_id === school.id);

describe('GET /school', () => {
  it('shows General with read-only time zone, branding and sign-in rules, the summary and an etag', async () => {
    const { school, admin } = await arrange();
    await setSignInRules(db(), school.id, { twoStep: 'admins', passwordMinLength: 12 });

    const response = await as(admin)('GET', '/school');

    expect(response.statusCode).toBe(200);
    const body = School.parse(response.json());
    expect(body).toEqual({
      name: school.name,
      shortName: school.shortName,
      officeEmail: null,
      officePhone: null,
      address: null,
      timeZone: 'Asia/Colombo',
      smsSenderId: null,
      smsSenderStatus: null,
      branding: { color: brandPalette(null).color, logoUrl: null },
      signIn: { twoStep: 'admins', passwordMinLength: 12, sessionHours: 12, ipAllowlist: [] },
      summary: {
        parts: [
          { code: 'ask_quad_on' },
          { code: 'quiet_hours', from: '18:00', until: '07:00', weekends: true },
        ],
        needs: [{ code: 'add_office_email' }],
      },
      etag: expect.any(String) as string,
    });
    expect(response.headers.etag).toBe(body.etag);
    // The same state reads as the same version.
    expect((await schoolOf(admin)).etag).toBe(body.etag);
  });

  it('lets a principal (settings.view) read it', async () => {
    const { principal } = await arrange();
    expect((await as(principal)('GET', '/school')).statusCode).toBe(200);
  });

  it('answers 401 without a session', async () => {
    const response = await new Browser(app).get('/school');
    expect(response.statusCode).toBe(401);
  });

  it('answers 403 forbidden to a teacher (no settings.view)', async () => {
    const { teacher } = await arrange();
    const response = await as(teacher)('GET', '/school');
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
  });

  it("shows only the session's own school, for the same person in two schools, whatever the query says", async () => {
    const a = await arrange();
    const b = await schoolWithRoles(db());
    const inB = await staffHolding(db(), b, b.roles.admin, { accountId: a.admin.accountId });
    expect((await patch(inB, { officeEmail: 'office@b-school.test' })).statusCode).toBe(200);

    const fromA = await as(a.admin)('GET', `/school?tenantId=${b.id}`);

    expect(School.parse(fromA.json())).toMatchObject({ name: a.school.name, officeEmail: null });
    expect((await schoolOf(inB)).officeEmail).toBe('office@b-school.test');
  });
});

describe('PATCH /school', () => {
  it('saves General, checks the phone against the school’s country, and audits the changed fields', async () => {
    const { school, admin } = await arrange();
    const before = await schoolOf(admin);

    const response = await patch(
      admin,
      {
        name: ' Colombo International School ',
        officeEmail: 'Office@Colombo-Intl.test',
        officePhone: '011 234 5678',
        address: '12 Example Road, Colombo 7',
        smsSenderId: 'COLOMBOINTL',
      },
      before.etag,
    );

    expect(response.statusCode).toBe(200);
    const after = School.parse(response.json());
    expect(after).toMatchObject({
      name: 'Colombo International School',
      officeEmail: 'office@colombo-intl.test',
      officePhone: '+94112345678',
      address: '12 Example Road, Colombo 7',
      smsSenderId: 'COLOMBOINTL',
      smsSenderStatus: 'requested',
      summary: { needs: [{ code: 'sms_sender_pending', senderId: 'COLOMBOINTL' }] },
    });
    expect(after.etag).not.toBe(before.etag);
    expect(response.headers.etag).toBe(after.etag);
    expect(await tenantName(school.id)).toBe('Colombo International School');
    expect(await settingsRow(school.id)).toMatchObject({ updated_by: admin.userId });

    const audits = await updatesIn(school);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actor_user_id: admin.userId,
      target_type: 'school',
      target_id: school.id,
      meta: {
        fields: ['name', 'officeEmail', 'officePhone', 'address', 'smsSenderId', 'smsSenderStatus'],
        before: {
          name: school.name,
          officeEmail: null,
          officePhone: null,
          address: null,
          smsSenderId: null,
          smsSenderStatus: null,
        },
        after: {
          name: 'Colombo International School',
          officeEmail: 'office@colombo-intl.test',
          officePhone: '+94112345678',
          address: '12 Example Road, Colombo 7',
          smsSenderId: 'COLOMBOINTL',
          smsSenderStatus: 'requested',
        },
      },
    });
    // The rename is also Quad's to know about (update_current_tenant_name, platform_audit).
    const { rows } = await db().platform.query<{ meta: { from: string; to: string } }>(
      `select meta from platform_audit where action = 'tenant.renamed' and tenant_id = $1`,
      [school.id],
    );
    expect(rows.map((row) => row.meta)).toEqual([
      { from: school.name, to: 'Colombo International School' },
    ]);
  });

  it('audits only what changed, and writes nothing when nothing changed', async () => {
    const { school, admin } = await arrange();
    expect((await patch(admin, { officeEmail: 'office@one.test' })).statusCode).toBe(200);
    // Positive control above: one entry. The same values again change nothing.
    const same = await patch(admin, { officeEmail: 'office@one.test', name: school.name });
    expect(same.statusCode).toBe(200);
    expect(await updatesIn(school)).toHaveLength(1);
    expect((await updatesIn(school))[0]?.meta).toMatchObject({ fields: ['officeEmail'] });

    expect((await patch(admin, { officeEmail: null, address: 'Kandy' })).statusCode).toBe(200);
    const audits = await updatesIn(school);
    expect(audits.map((row) => row.meta['fields'])).toEqual([
      ['officeEmail'],
      ['officeEmail', 'address'],
    ]);
    expect(await settingsRow(school.id)).toMatchObject({ office_email: null, address: 'Kandy' });
  });

  it('withdraws a sender ID with null, and asks again for a new one in place of an approved one', async () => {
    const { school, admin } = await arrange();
    expect((await patch(admin, { smsSenderId: 'CIS' })).statusCode).toBe(200);
    await db().platform.query(
      `update school_settings set sms_sender_status = 'approved' where tenant_id = $1`,
      [school.id],
    );
    expect(School.parse((await patch(admin, { smsSenderId: 'CIS' })).json())).toMatchObject({
      smsSenderStatus: 'approved',
    });
    expect(School.parse((await patch(admin, { smsSenderId: 'COLOMBO' })).json())).toMatchObject({
      smsSenderStatus: 'requested',
    });
    expect(School.parse((await patch(admin, { smsSenderId: null })).json())).toMatchObject({
      smsSenderId: null,
      smsSenderStatus: null,
    });
  });

  it.each([
    ['timeZone', 'Asia/Dubai'],
    ['branding', { color: '#000000' }],
    ['brandColor', '#000000'],
    ['logoUrl', 'https://example.test/logo.png'],
    ['signIn', { twoStep: 'off' }],
    ['twoStep', 'off'],
    ['passwordMinLength', 10],
    ['sessionHours', 24],
    ['ipAllowlist', []],
    ['shortName', 'XYZ'],
  ])('refuses %s with 400: managed by Quad, never silently ignored', async (field, value) => {
    const { school, admin } = await arrange();
    const response = await patch(admin, { name: 'Renamed School', [field]: value });
    expect(response.statusCode).toBe(400);
    const body = response.json<{ code: string; fields: Record<string, string> }>();
    expect(body.code).toBe('validation');
    expect(body.fields['_root']).toMatch(/managed by Quad/);
    expect(await tenantName(school.id)).toBe(school.name);
  });

  it('answers 400 validation for a bad field, nothing to change, or no If-Match', async () => {
    const { school, admin } = await arrange();
    const etag = (await schoolOf(admin)).etag;
    const fieldsOf = async (
      body: unknown,
      headers: Record<string, string> = { 'if-match': etag },
    ) => {
      const response = await as(admin)('PATCH', '/school', body, headers);
      expect(response.statusCode).toBe(400);
      return Object.keys(response.json<{ fields: Record<string, string> }>().fields);
    };
    expect(await fieldsOf({ officeEmail: 'office' })).toEqual(['officeEmail']);
    expect(await fieldsOf({ name: '   ' })).toEqual(['name']);
    expect(await fieldsOf({ smsSenderId: 'NO' })).toEqual(['smsSenderId']);
    expect(await fieldsOf({})).toEqual(['_root']);
    expect(await fieldsOf({ officeEmail: 'office@one.test' }, {})).toEqual(['if-match']);
    expect(await settingsRow(school.id)).toMatchObject(UNTOUCHED);
  });

  it('checks the office phone against the school’s own country, not a Sri Lankan default (D35)', async () => {
    const lk = await arrange();
    const lkPhone = await patch(lk.admin, { officePhone: '+44 20 7946 0000' });
    expect(lkPhone.statusCode).toBe(400);
    expect(Object.keys(lkPhone.json<{ fields: Record<string, string> }>().fields)).toEqual([
      'officePhone',
    ]);

    const gb = await arrange({ country: 'GB' });
    expect((await patch(gb.admin, { officePhone: '011 234 5678' })).statusCode).toBe(400);
    const saved = await patch(gb.admin, { officePhone: '+44 20 7946 0000' });
    expect(saved.statusCode).toBe(200);
    expect(School.parse(saved.json()).officePhone).toBe('+442079460000');
  });

  it('answers 409 conflict with the current version for a stale If-Match, and changes nothing', async () => {
    const { school, admin } = await arrange();
    const stale = (await schoolOf(admin)).etag;
    expect((await patch(admin, { address: 'First' }, stale)).statusCode).toBe(200);
    const current = (await schoolOf(admin)).etag;

    const response = await patch(admin, { address: 'Second' }, stale);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'conflict' });
    expect(response.headers.etag).toBe(current);
    expect((await settingsRow(school.id))?.address).toBe('First');
    // Positive control: the first change was audited; the refused one was not.
    expect(await updatesIn(school)).toHaveLength(1);
  });

  it('answers 403 to a teacher, to a principal (view only) and while previewing a role', async () => {
    const { school, admin, principal, teacher } = await arrange();
    // Read as the principal: the admin's session is first used after the preview is set.
    const etag = (await schoolOf(principal)).etag;
    for (const member of [teacher, principal]) {
      const response = await as(member)('PATCH', '/school', { address: 'X' }, { 'if-match': etag });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'forbidden' });
    }
    await setPreview(db(), admin.session.id, school.roles.principal);
    const previewing = await as(admin)('PATCH', '/school', { address: 'X' }, { 'if-match': etag });
    expect(previewing.statusCode).toBe(403);
    expect(previewing.json()).toMatchObject({ code: 'preview_read_only' });
    expect(await settingsRow(school.id)).toMatchObject(UNTOUCHED);
  });

  it("changes only the session's school: B's admin never reaches A, and A's version is no use in B", async () => {
    const a = await arrange();
    const b = await arrange();
    const etagA = (await schoolOf(a.admin)).etag;

    const response = await as(b.admin)(
      'PATCH',
      `/school?tenantId=${a.school.id}`,
      {
        name: 'Taken Over',
      },
      { 'if-match': (await schoolOf(b.admin)).etag },
    );

    expect(response.statusCode).toBe(200);
    expect(await tenantName(b.school.id)).toBe('Taken Over');
    expect(await tenantName(a.school.id)).toBe(a.school.name);
    // Positive control: B's own change was audited, in B.
    expect(await updatesIn(b.school)).toHaveLength(1);
    expect(await updatesIn(a.school)).toEqual([]);
    expect((await patch(b.admin, { name: 'Again' }, etagA)).statusCode).toBe(409);
  });

  it('is audited as the Quad staff member in a support visit', async () => {
    const { school } = await arrange();
    const quad = await insertPlatformUser(db(), 'Quad Support');
    const visit = await insertSupportVisit(db(), quad, school.id);
    const etag = School.parse((await asStaff(app, visit)('GET', '/school')).json()).etag;

    const response = await asStaff(app, visit)(
      'PATCH',
      '/school',
      { address: 'Kandy' },
      {
        'if-match': etag,
      },
    );

    expect(response.statusCode).toBe(200);
    expect((await updatesIn(school))[0]).toMatchObject({
      actor_user_id: null,
      actor_platform_user_id: quad,
    });
    expect(await settingsRow(school.id)).toMatchObject({ updated_by: null });
  });
});

describe('GET /school/branding', () => {
  it("returns the school's colour and logo, or Quad's default colour", async () => {
    const { school, teacher } = await arrange();
    expect(SchoolBranding.parse((await as(teacher)('GET', '/school/branding')).json())).toEqual({
      color: brandPalette(null).color,
      logoUrl: null,
    });
    await db().platform.query(
      `insert into tenant_branding (tenant_id, brand_color) values ($1, '#0F766E')`,
      [school.id],
    );
    expect(SchoolBranding.parse((await as(teacher)('GET', '/school/branding')).json())).toEqual({
      color: brandPalette('#0F766E').color,
      logoUrl: null,
    });
  });

  it('answers 401 without a session', async () => {
    expect((await new Browser(app).get('/school/branding')).statusCode).toBe(401);
  });

  it('answers 403 school_suspended while the school is suspended', async () => {
    const { school, teacher } = await arrange();
    await suspendSchool(db(), school.id, 'Unpaid invoice');
    const response = await as(teacher)('GET', '/school/branding');
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'school_suspended' });
  });

  it("gives each session its own school's brand, whatever the query says", async () => {
    const a = await arrange();
    const b = await arrange();
    await db().platform.query(
      `insert into tenant_branding (tenant_id, brand_color) values ($1, '#0F766E'), ($2, '#7C3AED')`,
      [a.school.id, b.school.id],
    );
    const fromA = await as(a.teacher)('GET', `/school/branding?tenantId=${b.school.id}`);
    expect(SchoolBranding.parse(fromA.json()).color).toBe(brandPalette('#0F766E').color);
    const fromB = await as(b.teacher)('GET', '/school/branding');
    expect(SchoolBranding.parse(fromB.json()).color).toBe(brandPalette('#7C3AED').color);
  });
});

describe('GET /settings', () => {
  it("returns the school's settings, read-only in M1, with the spec's defaults", async () => {
    const { school, admin } = await arrange();
    const response = await as(admin)('GET', '/settings');
    expect(response.statusCode).toBe(200);
    expect(SchoolSettings.parse(response.json())).toEqual({
      askQuadEnabled: true,
      askQuadKeepConversations: true,
      ewShareWithParents: 'after_plan',
      absenceAlert: 'at_time',
      absenceAlertTime: '09:00',
      reminderDays: [-3, 7, 14],
      photoConsentDefault: 'class',
      familyCircleEnabled: true,
      quietHoursEnabled: true,
      quietFrom: '18:00',
      quietUntil: '07:00',
      quietWeekends: true,
      updatedAt: expect.any(String) as string,
    });
    await db().platform.query(
      `update school_settings set quiet_from = '20:30', quiet_weekends = false,
         ask_quad_enabled = false where tenant_id = $1`,
      [school.id],
    );
    expect(SchoolSettings.parse((await as(admin)('GET', '/settings')).json())).toMatchObject({
      quietFrom: '20:30',
      quietWeekends: false,
      askQuadEnabled: false,
    });
    expect(School.parse((await as(admin)('GET', '/school')).json()).summary.parts).toEqual([
      { code: 'ask_quad_off' },
      { code: 'quiet_hours', from: '20:30', until: '07:00', weekends: false },
    ]);
  });

  it('answers 401 without a session', async () => {
    expect((await new Browser(app).get('/settings')).statusCode).toBe(401);
  });

  it('lets a principal read it (settings.view; 08 wins over 06) but not a teacher (403)', async () => {
    const { principal, teacher } = await arrange();
    expect((await as(principal)('GET', '/settings')).statusCode).toBe(200);
    const refused = await as(teacher)('GET', '/settings');
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'forbidden' });
  });

  it("shows only the session's own school's settings", async () => {
    const a = await arrange();
    const b = await arrange();
    await as(b.admin)('GET', '/settings');
    await db().platform.query(
      `update school_settings set quiet_from = '21:00' where tenant_id = $1`,
      [b.school.id],
    );
    const fromA = await as(a.admin)('GET', `/settings?tenantId=${b.school.id}`);
    expect(SchoolSettings.parse(fromA.json()).quietFrom).toBe('18:00');
    expect(SchoolSettings.parse((await as(b.admin)('GET', '/settings')).json()).quietFrom).toBe(
      '21:00',
    );
  });
});
