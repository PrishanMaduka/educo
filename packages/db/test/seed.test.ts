import { verify } from '@node-rs/argon2';
import { PlanModule, SystemRoleKey } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import {
  SEED_PEOPLE,
  SEED_PLATFORM_USERS,
  SEED_TENANTS,
  createFieldCipher,
  seedDatabase,
} from '../src/internal';

import { useTestDatabase } from './setup';

const testDb = useTestDatabase();

/** Test-only secrets: neither is the published placeholder nor used anywhere else. */
const SECRETS = {
  password: 'seed-test-password-not-for-anything-else',
  fieldEncryptionKey: 'seed-test-field-encryption-key-0123456789',
};

const CIS = SEED_TENANTS.colomboIntl.id;
const KHA = SEED_TENANTS.kandyHill.id;
const STAFF = [SEED_PEOPLE.prishan, SEED_PEOPLE.nadeesha, SEED_PEOPLE.ruwan, SEED_PEOPLE.dilini];

const rows = async <T extends Record<string, unknown>>(text: string, values: unknown[] = []) =>
  (await testDb().platform.query<T>(text, values)).rows;

/** Everything the seed writes, without hashes, sealed secrets or timestamps. */
async function seededState() {
  return {
    tenants: await rows('select id, name from tenants order by id'),
    branding: await rows('select tenant_id, brand_color from tenant_branding order by tenant_id'),
    security: await rows('select tenant_id, two_step from tenant_security order by tenant_id'),
    modules: await rows(
      'select tenant_id, module, enabled from tenant_modules order by tenant_id, module',
    ),
    settings: await rows('select tenant_id from school_settings order by tenant_id'),
    roles: await rows(
      'select id, tenant_id, key, name, system, scope from roles order by tenant_id, key',
    ),
    platformUsers: await rows(
      'select id, name, email, role, status, totp_enabled from platform_users order by id',
    ),
    accounts: await rows('select id, email, phone_e164, status from accounts order by id'),
    credentials: await rows(
      'select account_id, totp_enabled, totp_secret_enc from credentials order by account_id',
    ),
    users: await rows(
      'select id, tenant_id, account_id, kind, name, email, phone_e164, status from users order by id',
    ),
    userRoles: await rows(
      'select tenant_id, user_id, role_id, "primary" from user_roles order by tenant_id, user_id',
    ),
  };
}

describe('seed', () => {
  it('inserts the two seed schools with fixed ids, and running it twice changes nothing', async () => {
    await seedDatabase(testDb().ownerUrl, SECRETS);
    const first = await seededState();
    await seedDatabase(testDb().ownerUrl, SECRETS);
    expect(await seededState()).toEqual(first);

    const tenants = await rows(
      `select id, name, short_name, slug, country, region, time_zone, currency, locale, status,
              to_char(since, 'YYYY-MM-DD') as since
       from tenants order by slug`,
    );
    expect(tenants).toEqual([
      {
        id: CIS,
        name: 'Colombo International School',
        short_name: 'CIS',
        slug: 'colombo-intl',
        country: 'LK',
        region: 'ap-south',
        time_zone: 'Asia/Colombo',
        currency: 'LKR',
        locale: 'en-LK',
        status: 'active',
        since: '2024-01-01',
      },
      {
        id: KHA,
        name: 'Kandy Hill Academy',
        short_name: 'KHA',
        slug: 'kandy-hill',
        country: 'LK',
        region: 'ap-south',
        time_zone: 'Asia/Colombo',
        currency: 'LKR',
        locale: 'en-LK',
        status: 'active',
        since: '2024-06-01',
      },
    ]);
  });

  it('gives each school its colour, plan modules, two-step rule, settings and the seven system roles', async () => {
    const state = await seededState();
    expect(state.branding).toEqual([
      { tenant_id: CIS, brand_color: '#DD4A42' },
      { tenant_id: KHA, brand_color: '#2BB0A0' },
    ]);
    expect(state.security).toEqual([
      { tenant_id: CIS, two_step: 'staff' },
      { tenant_id: KHA, two_step: 'admins' },
    ]);
    const enabled = (tenantId: string) =>
      state.modules
        .filter((row) => row.tenant_id === tenantId && row.enabled === true)
        .map((row) => String(row.module))
        .sort();
    expect(enabled(CIS)).toEqual([...PlanModule.options].sort());
    expect(enabled(KHA)).toEqual(PlanModule.options.filter((m) => m !== 'transport').sort());
    expect(state.settings).toEqual([{ tenant_id: CIS }, { tenant_id: KHA }]);
    for (const tenantId of [CIS, KHA]) {
      const roles = state.roles.filter((role) => role.tenant_id === tenantId);
      expect(roles.map((role) => role.key)).toEqual([...SystemRoleKey.options].sort());
      expect(roles.every((role) => role.system === true)).toBe(true);
    }
    expect(state.roles.find((role) => role.key === 'teacher')).toMatchObject({
      name: 'Teacher',
      scope: 'own_classes',
    });
    // The prototype's settings defaults come from the table (spec 08).
    const [settings] = await rows<{ quiet_from: string; reminder_days: number[] }>(
      'select quiet_from, reminder_days from school_settings where tenant_id = $1',
      [CIS],
    );
    expect(settings).toEqual({ quiet_from: '18:00:00', reminder_days: [-3, 7, 14] });
  });

  it('seeds the people with their schools and roles; auth_memberships(ruwan) finds both schools', async () => {
    const memberships = async (accountId: string) =>
      (
        await testDb().app.query<{ tenant_name: string; kind: string; role_names: string[] }>(
          'select tenant_name, kind, role_names from auth_memberships($1)',
          [accountId],
        )
      ).rows;

    expect(await memberships(SEED_PEOPLE.ruwan.accountId)).toEqual([
      { tenant_name: 'Colombo International School', kind: 'staff', role_names: ['Teacher'] },
      { tenant_name: 'Kandy Hill Academy', kind: 'staff', role_names: ['Teacher'] },
    ]);
    expect(await memberships(SEED_PEOPLE.prishan.accountId)).toEqual([
      { tenant_name: 'Colombo International School', kind: 'staff', role_names: ['School admin'] },
    ]);
    expect(await memberships(SEED_PEOPLE.dilini.accountId)).toEqual([
      {
        tenant_name: 'Colombo International School',
        kind: 'staff',
        role_names: ['Finance officer'],
      },
    ]);
    expect(await memberships(SEED_PEOPLE.dilhani.accountId)).toEqual([
      { tenant_name: 'Colombo International School', kind: 'guardian', role_names: [] },
    ]);
    const [dilhani] = await rows('select email, phone_e164 from accounts where id = $1', [
      SEED_PEOPLE.dilhani.accountId,
    ]);
    expect(dilhani).toEqual({ email: null, phone_e164: '+94770000001' });
    // A parent signs in with a one-time code: no password, no authenticator.
    expect(
      await rows('select 1 from credentials where account_id = $1', [
        SEED_PEOPLE.dilhani.accountId,
      ]),
    ).toEqual([]);
  });

  it('gives every seeded staff member and console user SEED_PASSWORD, hashed with Argon2id', async () => {
    const hashes = [
      ...(await rows<{ password_hash: string }>(
        'select password_hash from credentials where account_id = any($1)',
        [STAFF.map((person) => person.accountId)],
      )),
      ...(await rows<{ password_hash: string }>(
        'select password_hash from platform_users where id = any($1)',
        [Object.values(SEED_PLATFORM_USERS).map((user) => user.id)],
      )),
    ].map((row) => row.password_hash);
    expect(hashes).toHaveLength(6);
    for (const hash of hashes) {
      expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      await expect(verify(hash, SECRETS.password)).resolves.toBe(true);
      await expect(verify(hash, 'not-the-seed-password')).resolves.toBe(false);
    }
  });

  it('turns on an authenticator for the four staff and both console users, sealed with the field key', async () => {
    const cipher = createFieldCipher(SECRETS.fieldEncryptionKey);
    const sealed = [
      ...(await rows<{ totp_enabled: boolean; totp_secret_enc: string }>(
        'select totp_enabled, totp_secret_enc from credentials where account_id = any($1)',
        [STAFF.map((person) => person.accountId)],
      )),
      ...(await rows<{ totp_enabled: boolean; totp_secret_enc: string }>(
        'select totp_enabled, totp_secret_enc from platform_users where id = any($1)',
        [Object.values(SEED_PLATFORM_USERS).map((user) => user.id)],
      )),
    ];
    expect(sealed).toHaveLength(6);
    for (const row of sealed) {
      expect(row.totp_enabled).toBe(true);
      await expect(cipher.decrypt(row.totp_secret_enc)).resolves.toMatch(/^[A-Z2-7]{32}$/);
    }
    const platform = await rows('select email, role from platform_users order by email');
    expect(platform).toEqual([
      { email: 'owner@quad.local', role: 'owner' },
      { email: 'support@quad.local', role: 'support' },
    ]);
  });

  it('replaces an authenticator secret that no longer opens under the field key', async () => {
    const otherKey = 'another-seed-test-field-encryption-key-987';
    await seedDatabase(testDb().ownerUrl, { ...SECRETS, fieldEncryptionKey: otherKey });
    const [row] = await rows<{ totp_secret_enc: string }>(
      'select totp_secret_enc from credentials where account_id = $1',
      [SEED_PEOPLE.prishan.accountId],
    );
    await expect(createFieldCipher(otherKey).decrypt(row?.totp_secret_enc ?? '')).resolves.toMatch(
      /^[A-Z2-7]{32}$/,
    );
    await seedDatabase(testDb().ownerUrl, SECRETS);
  });

  it('restores edited seed rows to their seed values', async () => {
    await testDb().platform.query(`update tenants set name = 'Renamed' where slug = 'kandy-hill'`);
    await testDb().platform.query(`update tenant_security set two_step = 'off'`);
    await testDb().platform.query(`delete from user_roles where user_id = $1`, [
      SEED_PEOPLE.prishan.memberships[0].userId,
    ]);
    await seedDatabase(testDb().ownerUrl, SECRETS);
    expect(await rows('select name from tenants where id = $1', [KHA])).toEqual([
      { name: 'Kandy Hill Academy' },
    ]);
    expect(await rows('select two_step from tenant_security order by tenant_id')).toEqual([
      { two_step: 'staff' },
      { two_step: 'admins' },
    ]);
    expect(
      await rows(
        `select r.key, ur."primary" from user_roles ur join roles r on r.id = ur.role_id
         where ur.user_id = $1`,
        [SEED_PEOPLE.prishan.memberships[0].userId],
      ),
    ).toEqual([{ key: 'admin', primary: true }]);
  });

  it('refuses to run without a password or with a short field key, writing nothing', async () => {
    await expect(seedDatabase(testDb().ownerUrl, { ...SECRETS, password: '' })).rejects.toThrow(
      'SEED_PASSWORD is required',
    );
    await expect(
      seedDatabase(testDb().ownerUrl, { ...SECRETS, fieldEncryptionKey: 'too-short' }),
    ).rejects.toThrow(/FIELD_ENCRYPTION_KEY/);
  });
});
