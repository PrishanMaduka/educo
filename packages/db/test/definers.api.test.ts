import { randomBytes } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  createAccountRunner,
  createDefinerCalls,
  createPlatformRunner,
  createTenantRunner,
  uuidv7,
} from '../src/internal';

import {
  insertAccount,
  insertCredentials,
  insertPlatformUser,
  insertRole,
  insertSession,
  insertSupportSession,
  insertTenant,
  insertUser,
  insertUserRole,
  randomTokenHash,
} from './factories';
import { postgresCause } from './pg-error';
import { useTestDatabase } from './setup';

import type {
  Account,
  AccountRunner,
  DefinerCalls,
  PlatformRunner,
  PlatformUser,
  Role,
  Tenant,
  TenantRunner,
  User,
} from '../src/internal';
import type pg from 'pg';

const testDb = useTestDatabase();

/** The definers this task adds (D16, D32), with their argument types for `regprocedure`. */
const DEFINERS = [
  'auth_memberships(uuid)',
  'account_by_identifier(citext, text)',
  'session_by_token(bytea)',
  'auth_sign_in_rules(uuid)',
  'current_tenant_profile()',
  'update_current_tenant_name(text, text)',
  'consume_signed_token(text, text, timestamptz)',
  'record_support_audit(uuid, text, text, uuid, jsonb)',
  'ensure_account_for_email(citext)',
  'member_two_step_status(uuid[])',
  'revoke_member_sessions(uuid)',
  'redeem_support_session(uuid, bytea)',
  'end_support_session(bytea)',
  'tenant_by_embed_key(text)',
  'tenant_by_gateway_account(text, text)',
  'current_support_visit(uuid)',
  'refresh_family(uuid)',
  'clear_member_preview(uuid)',
  'member_account_email(uuid)',
  'member_has_other_memberships(uuid)',
] as const;

/** The tables `definer_read` opens to `quad_owner` (and only to it). */
const DEFINER_READ_TABLES = ['accounts', 'sessions', 'users', 'user_roles', 'roles'] as const;

const HOUR_MS = 60 * 60 * 1000;

let withTenant: TenantRunner;
let withAccount: AccountRunner;
let withPlatform: PlatformRunner;
let definers: DefinerCalls;

/** Active schools A and B, plus a suspended, a deleted and a guardian-only school. */
let schoolA: Tenant;
let schoolB: Tenant;
let suspended: Tenant;
let deleted: Tenant;
let guardianSchool: Tenant;
let deactivatedSchool: Tenant;

/** Belongs to every school above (deactivated in `deactivatedSchool`, guardian in `guardianSchool`). */
let person: Account;
let personInA: User;
let personInB: User;
/** The same person as a guardian in `guardianSchool`. */
let personAsGuardian: User;
let adminRoleA: Role;
let teacherRoleA: Role;
/** A second member of A, with no credentials row. */
let colleague: Account;
let colleagueInA: User;
/** Only in B. */
let outsider: Account;
let outsiderInB: User;
let quadStaff: PlatformUser;

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected the call to fail.');
    },
    (caught: unknown) => postgresCause(caught),
  );
}

/** Runs `fn` on one `quad_app` connection inside a transaction that is always rolled back. */
async function asApp<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await testDb().app.connect();
  try {
    await client.query('begin');
    return await fn(client);
  } finally {
    await client.query('rollback');
    client.release();
  }
}

async function platformRows<T extends pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await testDb().platform.query<T>(text, values);
  return result.rows;
}

beforeAll(async () => {
  const { app, platform } = testDb();
  withTenant = createTenantRunner(app);
  withAccount = createAccountRunner(app);
  withPlatform = createPlatformRunner(platform);
  definers = createDefinerCalls(app);

  schoolA = await insertTenant(withPlatform, { name: 'Colombo Test School', shortName: 'CTS' });
  schoolB = await insertTenant(withPlatform, { name: 'Kandy Test School', shortName: 'KTS' });
  suspended = await insertTenant(withPlatform, {
    status: 'suspended',
    suspendReason: 'Unpaid invoice',
  });
  deleted = await insertTenant(withPlatform, { status: 'deleted' });
  guardianSchool = await insertTenant(withPlatform);
  deactivatedSchool = await insertTenant(withPlatform);

  await testDb().platform.query(
    `insert into tenant_security (tenant_id, two_step, password_min_length, session_hours)
     values ($1, 'admins', 12, 8),
            ($2, 'all', 14, 12),
            ($3, 'off', 10, 12)`,
    [schoolA.id, schoolB.id, deleted.id],
  );
  await testDb().platform.query(
    `insert into tenant_branding (tenant_id, brand_color) values ($1, '#0f766e')`,
    [schoolA.id],
  );
  await testDb().platform.query(
    `insert into tenant_modules (tenant_id, module, enabled)
     values ($1, 'sis', true), ($1, 'admissions', true), ($1, 'fees', false), ($2, 'crm', true)`,
    [schoolA.id, schoolB.id],
  );

  person = await insertAccount(withAccount, { phoneE164: '+94770000123' });
  personInA = await insertUser(withTenant, schoolA.id, person.id);
  personInB = await insertUser(withTenant, schoolB.id, person.id);
  await insertUser(withTenant, suspended.id, person.id);
  await insertUser(withTenant, deleted.id, person.id);
  personAsGuardian = await insertUser(withTenant, guardianSchool.id, person.id, {
    kind: 'guardian',
  });
  await insertUser(withTenant, deactivatedSchool.id, person.id, { status: 'deactivated' });
  adminRoleA = await insertRole(withTenant, schoolA.id, { key: 'admin', name: 'School admin' });
  teacherRoleA = await insertRole(withTenant, schoolA.id, { key: 'teacher', name: 'Teacher' });
  await insertUserRole(withTenant, schoolA.id, personInA.id, adminRoleA.id);
  await insertUserRole(withTenant, schoolA.id, personInA.id, teacherRoleA.id, { primary: false });
  const roleB = await insertRole(withTenant, schoolB.id, { key: 'teacher', name: 'Teacher' });
  await insertUserRole(withTenant, schoolB.id, personInB.id, roleB.id);
  await insertCredentials(withAccount, person.id, { totpEnabled: true });

  colleague = await insertAccount(withAccount);
  colleagueInA = await insertUser(withTenant, schoolA.id, colleague.id);
  outsider = await insertAccount(withAccount);
  outsiderInB = await insertUser(withTenant, schoolB.id, outsider.id);
  await insertCredentials(withAccount, outsider.id, { totpEnabled: true });

  quadStaff = await insertPlatformUser(withPlatform);
});

describe('the definers are locked down (D16)', () => {
  it.each(DEFINERS)(
    '%s is a security definer owned by quad_owner, with a pinned search_path, executable by quad_app only',
    async (signature) => {
      const { rows } = await testDb().owner.query<{
        definer: boolean;
        owner: string;
        config: string[] | null;
        app: boolean;
        platform: boolean;
        public: boolean;
      }>(
        `select p.prosecdef as definer,
                pg_get_userbyid(p.proowner) as owner,
                p.proconfig as config,
                has_function_privilege('quad_app', p.oid, 'EXECUTE') as app,
                has_function_privilege('quad_platform', p.oid, 'EXECUTE') as platform,
                exists (select 1 from aclexplode(p.proacl) a
                        where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public
         from pg_proc p where p.oid = $1::regprocedure`,
        [signature],
      );
      expect(rows).toEqual([
        {
          definer: true,
          owner: 'quad_owner',
          config: ['search_path=public, pg_temp'],
          app: true,
          platform: false,
          public: false,
        },
      ]);
    },
  );

  it('with_account_scope is not callable by quad_app and is not a security definer', async () => {
    const { rows } = await testDb().owner.query<{ definer: boolean; app: boolean }>(
      `select p.prosecdef as definer, has_function_privilege('quad_app', p.oid, 'EXECUTE') as app
       from pg_proc p where p.oid = 'with_account_scope(uuid, text, jsonb)'::regprocedure`,
    );
    expect(rows).toEqual([{ definer: false, app: false }]);
  });

  it('quad_app still gets permission denied on tenant_security', async () => {
    await expect(testDb().app.query('select * from tenant_security')).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('definer_read opens the five tables to quad_owner only', () => {
  it('has exactly one definer_read policy per listed table: permissive, SELECT, TO quad_owner, USING (true)', async () => {
    const { rows } = await testDb().owner.query<{
      table: string;
      permissive: boolean;
      command: string;
      roles: string[];
      qual: string | null;
      with_check: string | null;
    }>(
      `select c.relname as table, p.polpermissive as permissive, p.polcmd::text as command,
              array(select rolname::text from pg_roles where oid = any(p.polroles)) as roles,
              pg_get_expr(p.polqual, p.polrelid) as qual,
              pg_get_expr(p.polwithcheck, p.polrelid) as with_check
       from pg_policy p join pg_class c on c.oid = p.polrelid
       where p.polname = 'definer_read' order by c.relname`,
    );
    expect(rows).toEqual(
      [...DEFINER_READ_TABLES].sort().map((table) => ({
        table,
        permissive: true,
        command: 'r',
        roles: ['quad_owner'],
        qual: 'true',
        with_check: null,
      })),
    );
  });

  it.each(DEFINER_READ_TABLES)('as quad_app with no setting, %s returns no rows', async (table) => {
    const { rows } = await testDb().app.query<{ count: string }>(`select count(*) from ${table}`);
    expect(rows).toEqual([{ count: '0' }]);
  });

  it.each(['users', 'user_roles', 'roles'] as const)(
    "as quad_app under A, %s returns only A's rows",
    async (table) => {
      const tenantIds = await asApp(async (client) => {
        await client.query(`select set_config('app.tenant_id', $1, true)`, [schoolA.id]);
        const { rows } = await client.query<{ tenant_id: string }>(
          `select tenant_id::text from ${table}`,
        );
        return rows.map((row) => row.tenant_id);
      });
      expect(tenantIds.length).toBeGreaterThan(0);
      expect(new Set(tenantIds)).toEqual(new Set([schoolA.id]));
    },
  );

  it.each(['accounts', 'sessions'] as const)(
    'as quad_app under A with no account, %s returns no rows',
    async (table) => {
      const count = await asApp(async (client) => {
        await client.query(`select set_config('app.tenant_id', $1, true)`, [schoolA.id]);
        const { rows } = await client.query<{ count: string }>(`select count(*) from ${table}`);
        return rows[0]?.count;
      });
      expect(count).toBe('0');
    },
  );
});

describe('auth_memberships', () => {
  it('returns the active memberships of live schools, suspended ones flagged with the reason', async () => {
    const memberships = await definers.authMemberships(person.id);
    const byTenant = new Map(memberships.map((m) => [m.tenantId, m]));
    expect(new Set(byTenant.keys())).toEqual(
      new Set([schoolA.id, schoolB.id, suspended.id, guardianSchool.id]),
    );
    expect(byTenant.get(schoolA.id)).toEqual({
      tenantId: schoolA.id,
      tenantName: 'Colombo Test School',
      shortName: 'CTS',
      logoFileId: null,
      brandColor: '#0f766e',
      kind: 'staff',
      userId: personInA.id,
      roleNames: ['School admin', 'Teacher'],
      suspended: false,
      suspendReason: null,
    });
    expect(byTenant.get(suspended.id)).toMatchObject({
      suspended: true,
      suspendReason: 'Unpaid invoice',
    });
    expect(byTenant.get(guardianSchool.id)).toMatchObject({ kind: 'guardian', roleNames: [] });
  });

  it('omits a deactivated membership and a deleted school', async () => {
    const tenantIds = (await definers.authMemberships(person.id)).map((m) => m.tenantId);
    expect(tenantIds).not.toContain(deactivatedSchool.id);
    expect(tenantIds).not.toContain(deleted.id);
  });

  it('returns no email or phone column', async () => {
    const { fields } = await testDb().app.query('select * from auth_memberships($1)', [person.id]);
    expect(fields.map((field) => field.name)).toEqual([
      'tenant_id',
      'tenant_name',
      'short_name',
      'logo_file_id',
      'brand_color',
      'kind',
      'user_id',
      'role_names',
      'suspended',
      'suspend_reason',
    ]);
  });

  it('returns nothing for an unknown account', async () => {
    await expect(definers.authMemberships(uuidv7())).resolves.toEqual([]);
  });
});

describe('account_by_identifier', () => {
  it('finds an account by email, ignoring case, or by phone', async () => {
    const expected = { id: person.id, status: 'active', lockedUntil: null };
    const email = person.email?.toUpperCase() ?? '';
    await expect(definers.accountByIdentifier({ email })).resolves.toEqual(expected);
    await expect(definers.accountByIdentifier({ phone: '+94770000123' })).resolves.toEqual(
      expected,
    );
  });

  it('returns null for an unknown identifier', async () => {
    await expect(
      definers.accountByIdentifier({ email: 'nobody@example.test' }),
    ).resolves.toBeNull();
  });

  it('refuses both or neither identifier', async () => {
    const { app } = testDb();
    const both = await failure(
      app.query('select * from account_by_identifier($1, $2)', ['a@example.test', '+94770000123']),
    );
    const neither = await failure(app.query('select * from account_by_identifier(null, null)'));
    expect(both).toMatchObject({ code: '22023' });
    expect(neither).toMatchObject({ code: '22023' });
  });
});

describe('no Google or Microsoft sign-in is left in the database (D37, 0012)', () => {
  it('has no sso_methods_for_domain lookup', async () => {
    const { rows } = await testDb().owner.query<{ found: string | null }>(
      `select to_regprocedure('sso_methods_for_domain(citext)')::text as found`,
    );
    expect(rows).toEqual([{ found: null }]);
  });

  it('has no identities table and no sso_provider type', async () => {
    const { rows } = await testDb().owner.query<{ table: string | null; type: string | null }>(
      `select to_regclass('public.identities')::text as table,
              to_regtype('public.sso_provider')::text as type`,
    );
    expect(rows).toEqual([{ table: null, type: null }]);
  });

  it('keeps no SSO settings in tenant_security', async () => {
    const { rows } = await testDb().owner.query<{ name: string }>(
      `select attname as name from pg_attribute
       where attrelid = 'public.tenant_security'::regclass and attnum > 0 and not attisdropped
         and attname like 'sso%'`,
    );
    expect(rows).toEqual([]);
  });

  it('records only the password as a staff sign-in method', async () => {
    const { rows } = await testDb().owner.query<{ label: string }>(
      `select enumlabel as label from pg_enum
       where enumtypid = 'public.sign_in_method'::regtype order by enumsortorder`,
    );
    expect(rows).toEqual([{ label: 'password' }]);
  });
});

describe('auth_sign_in_rules', () => {
  it('returns one row per active staff membership with its role keys, and none for a guardian', async () => {
    const rules = await definers.authSignInRules(person.id);
    const byTenant = new Map(rules.map((rule) => [rule.tenantId, rule]));
    expect(new Set(byTenant.keys())).toEqual(new Set([schoolA.id, schoolB.id, suspended.id]));
    expect(byTenant.get(schoolA.id)).toEqual({
      tenantId: schoolA.id,
      twoStep: 'admins',
      roleKeys: ['admin', 'teacher'],
      passwordMinLength: 12,
    });
    expect(byTenant.get(schoolB.id)).toEqual({
      tenantId: schoolB.id,
      twoStep: 'all',
      roleKeys: ['teacher'],
      passwordMinLength: 14,
    });
    // No tenant_security row: the table defaults (two-step off, 10 characters).
    expect(byTenant.get(suspended.id)).toMatchObject({ twoStep: 'off', passwordMinLength: 10 });
  });
});

describe('refresh_family (a parent refresh token names its family, Task 9)', () => {
  async function family(overrides: Parameters<typeof insertSession>[2] = {}) {
    return insertSession(withAccount, person.id, {
      kind: 'mobile',
      stage: 'active',
      tokenHash: null,
      activeTenantId: guardianSchool.id,
      activeUserId: personAsGuardian.id,
      refreshHash: randomTokenHash(),
      ...overrides,
    });
  }

  it("returns only the live mobile family's account and school", async () => {
    const live = await family();
    const { rows, fields } = await testDb().app.query('select * from refresh_family($1)', [
      live.id,
    ]);
    expect(fields.map((field) => field.name)).toEqual(['account_id', 'tenant_id']);
    expect(rows).toEqual([{ account_id: person.id, tenant_id: guardianSchool.id }]);
    await expect(definers.refreshFamily(live.id)).resolves.toEqual({
      accountId: person.id,
      tenantId: guardianSchool.id,
    });
  });

  it('finds nothing for a revoked family, a family still choosing a school, or an unknown id', async () => {
    const revoked = await family({ revokedAt: new Date() });
    const choosing = await family({
      stage: 'choose_school',
      activeTenantId: null,
      activeUserId: null,
      refreshHash: null,
    });
    await expect(definers.refreshFamily(revoked.id)).resolves.toBeNull();
    await expect(definers.refreshFamily(choosing.id)).resolves.toBeNull();
    await expect(definers.refreshFamily(uuidv7())).resolves.toBeNull();
  });

  it("never finds a staff browser session, even another school's", async () => {
    const web = await insertSession(withAccount, outsider.id, {
      stage: 'active',
      activeTenantId: schoolB.id,
      activeUserId: outsiderInB.id,
    });
    await expect(definers.refreshFamily(web.id)).resolves.toBeNull();
  });
});

describe('session_by_token', () => {
  it("returns an account's live session with its school, stage and expiry fields", async () => {
    const tokenHash = randomTokenHash();
    const session = await insertSession(withAccount, person.id, {
      tokenHash,
      stage: 'active',
      activeTenantId: schoolA.id,
      activeUserId: personInA.id,
      keepSignedIn: true,
    });
    await expect(definers.sessionByToken(tokenHash)).resolves.toEqual({
      kind: 'web',
      sessionId: session.id,
      accountId: person.id,
      activeTenantId: schoolA.id,
      activeUserId: personInA.id,
      stage: 'active',
      expiresAt: session.expiresAt,
      lastSeenAt: session.lastSeenAt,
      keepSignedIn: true,
      previewRoleId: null,
      previewSampleUserId: null,
      supportSessionId: null,
    });
  });

  it('omits a revoked session and an unknown hash', async () => {
    const tokenHash = randomTokenHash();
    await insertSession(withAccount, person.id, { tokenHash, revokedAt: new Date() });
    await expect(definers.sessionByToken(tokenHash)).resolves.toBeNull();
    await expect(definers.sessionByToken(randomTokenHash())).resolves.toBeNull();
  });

  it('omits a console session (no account)', async () => {
    const tokenHash = randomTokenHash();
    await testDb().platform.query(
      `insert into sessions (platform_user_id, kind, stage, token_hash, expires_at)
       values ($1, 'console', 'active', $2, now() + interval '1 hour')`,
      [quadStaff.id, tokenHash],
    );
    await expect(definers.sessionByToken(tokenHash)).resolves.toBeNull();
  });

  describe('a sessions row tied to a support session', () => {
    async function sessionTiedTo(supportOverrides: {
      tenantId?: string;
      endedAt?: Date;
      expiresAt?: Date;
    }): Promise<Buffer> {
      const support = await insertSupportSession(
        withPlatform,
        quadStaff.id,
        supportOverrides.tenantId ?? schoolA.id,
        {
          ...(supportOverrides.endedAt ? { endedAt: supportOverrides.endedAt } : {}),
          ...(supportOverrides.expiresAt ? { expiresAt: supportOverrides.expiresAt } : {}),
        },
      );
      const tokenHash = randomTokenHash();
      await insertSession(withAccount, person.id, {
        tokenHash,
        stage: 'active',
        activeTenantId: schoolA.id,
        activeUserId: personInA.id,
        supportSessionId: support.id,
      });
      return tokenHash;
    }

    it('is returned while its support session is active and for the same school', async () => {
      const tokenHash = await sessionTiedTo({});
      await expect(definers.sessionByToken(tokenHash)).resolves.toMatchObject({ kind: 'web' });
    });

    it('is omitted once the support session has ended', async () => {
      const tokenHash = await sessionTiedTo({ endedAt: new Date() });
      await expect(definers.sessionByToken(tokenHash)).resolves.toBeNull();
    });

    it('is omitted once the support session has expired', async () => {
      const tokenHash = await sessionTiedTo({ expiresAt: new Date(Date.now() - 1000) });
      await expect(definers.sessionByToken(tokenHash)).resolves.toBeNull();
    });

    it('is omitted when the support session is for another school', async () => {
      const tokenHash = await sessionTiedTo({ tenantId: schoolB.id });
      await expect(definers.sessionByToken(tokenHash)).resolves.toBeNull();
    });
  });
});

describe('support sessions by token hash (R-support-token)', () => {
  it('redeems once, then session_by_token resolves the support visit to its school', async () => {
    const support = await insertSupportSession(withPlatform, quadStaff.id, schoolA.id);
    const tokenHash = randomTokenHash();
    await expect(definers.redeemSupportSession(support.id, tokenHash)).resolves.toBe(support.id);
    await expect(definers.redeemSupportSession(support.id, randomTokenHash())).resolves.toBeNull();
    await expect(definers.sessionByToken(tokenHash)).resolves.toEqual({
      kind: 'support',
      supportSessionId: support.id,
      platformUserId: quadStaff.id,
      tenantId: schoolA.id,
      expiresAt: support.expiresAt,
    });
  });

  it('refuses to redeem an ended or expired support session', async () => {
    const ended = await insertSupportSession(withPlatform, quadStaff.id, schoolA.id, {
      endedAt: new Date(),
    });
    const expired = await insertSupportSession(withPlatform, quadStaff.id, schoolA.id, {
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(definers.redeemSupportSession(ended.id, randomTokenHash())).resolves.toBeNull();
    await expect(definers.redeemSupportSession(expired.id, randomTokenHash())).resolves.toBeNull();
  });

  it('does not resolve a redeemed support session once it has expired', async () => {
    const support = await insertSupportSession(withPlatform, quadStaff.id, schoolA.id);
    const tokenHash = randomTokenHash();
    await definers.redeemSupportSession(support.id, tokenHash);
    await testDb().platform.query(
      `update support_sessions set expires_at = now() - interval '1 second' where id = $1`,
      [support.id],
    );
    await expect(definers.sessionByToken(tokenHash)).resolves.toBeNull();
  });

  it('ends the visit once, with one platform_audit row, and the token stops resolving', async () => {
    const support = await insertSupportSession(withPlatform, quadStaff.id, schoolB.id);
    const tokenHash = randomTokenHash();
    await definers.redeemSupportSession(support.id, tokenHash);
    // The first call names the visit it ended (Task 16: the API audits it in the school once);
    // the second finds nothing to end.
    await expect(definers.endSupportSession(tokenHash)).resolves.toEqual({
      supportSessionId: support.id,
      tenantId: schoolB.id,
      platformUserId: quadStaff.id,
    });
    await expect(definers.endSupportSession(tokenHash)).resolves.toBeNull();
    await expect(definers.sessionByToken(tokenHash)).resolves.toBeNull();
    const [row] = await platformRows<{ ended: boolean }>(
      'select ended_at is not null as ended from support_sessions where id = $1',
      [support.id],
    );
    expect(row).toEqual({ ended: true });
    const audit = await platformRows(
      `select actor_platform_user_id, action, target_type, tenant_id from platform_audit
       where target_id = $1`,
      [support.id],
    );
    expect(audit).toEqual([
      {
        actor_platform_user_id: quadStaff.id,
        action: 'support_session.ended',
        target_type: 'support_session',
        tenant_id: schoolB.id,
      },
    ]);
  });
});

describe('end_support_session across schools (Task 16)', () => {
  it("ends only the visit its cookie names: school A's visit stays active when B's ends", async () => {
    const inA = await insertSupportSession(withPlatform, quadStaff.id, schoolA.id);
    const inB = await insertSupportSession(withPlatform, quadStaff.id, schoolB.id);
    const hashA = randomTokenHash();
    const hashB = randomTokenHash();
    await definers.redeemSupportSession(inA.id, hashA);
    await definers.redeemSupportSession(inB.id, hashB);

    await expect(definers.endSupportSession(hashB)).resolves.toMatchObject({
      tenantId: schoolB.id,
    });

    await expect(definers.sessionByToken(hashA)).resolves.toMatchObject({
      kind: 'support',
      supportSessionId: inA.id,
    });
    await expect(definers.endSupportSession(randomTokenHash())).resolves.toBeNull();
    const ended = await platformRows<{ id: string }>(
      'select id from support_sessions where id = any($1) and ended_at is not null',
      [[inA.id, inB.id]],
    );
    expect(ended).toEqual([{ id: inB.id }]);
  });
});

describe('current_tenant_profile', () => {
  it("under withTenant(A) returns A's profile, settings and enabled modules only", async () => {
    const profile = await withTenant(schoolA.id, (tx) => definers.currentTenantProfile(tx));
    expect(profile).toEqual({
      name: 'Colombo Test School',
      shortName: 'CTS',
      status: 'active',
      suspendReason: null,
      timeZone: 'Asia/Colombo',
      locale: 'en-LK',
      currency: 'LKR',
      brandColor: '#0f766e',
      logoFileId: null,
      modules: ['admissions', 'sis'],
      twoStep: 'admins',
      passwordMinLength: 12,
      sessionHours: 8,
      ipAllowlist: [],
      country: 'LK',
    });
    const nameInB = await withTenant(schoolB.id, (tx) => definers.currentTenantProfile(tx));
    expect(nameInB).toMatchObject({ name: 'Kandy Test School', modules: ['crm'] });
  });

  it('gives each school its own country, for its phone numbers (D35, Task 14)', async () => {
    const elsewhere = await insertTenant(withPlatform, { country: 'AE', timeZone: 'Asia/Dubai' });
    const [inA, inElsewhere] = [
      await withTenant(schoolA.id, (tx) => definers.currentTenantProfile(tx)),
      await withTenant(elsewhere.id, (tx) => definers.currentTenantProfile(tx)),
    ];
    expect(inA?.country).toBe('LK');
    expect(inElsewhere).toMatchObject({ country: 'AE', timeZone: 'Asia/Dubai' });
  });

  it('returns no row without app.tenant_id', async () => {
    const { rows } = await testDb().app.query('select * from current_tenant_profile()');
    expect(rows).toEqual([]);
  });

  it('returns no SSO columns (D37, 0012)', async () => {
    const { fields } = await testDb().app.query('select * from current_tenant_profile()');
    expect(fields.map((field) => field.name)).toEqual([
      'name',
      'short_name',
      'status',
      'suspend_reason',
      'time_zone',
      'locale',
      'currency',
      'brand_color',
      'logo_file_id',
      'modules',
      'two_step',
      'password_min_length',
      'session_hours',
      'ip_allowlist',
      'country',
    ]);
  });
});

describe('update_current_tenant_name', () => {
  it('renames only the current school and writes platform_audit', async () => {
    const school = await insertTenant(withPlatform, { name: 'Old Name' });
    const renamed = await withTenant(school.id, (tx) =>
      definers.updateCurrentTenantName(tx, { expected: 'Old Name', name: 'New Name' }),
    );
    expect(renamed).toBe(true);
    const names = await platformRows<{ id: string; name: string }>(
      'select id, name from tenants where id = any($1::uuid[]) order by name',
      [[school.id, schoolB.id]],
    );
    expect(names).toEqual([
      { id: schoolB.id, name: 'Kandy Test School' },
      { id: school.id, name: 'New Name' },
    ]);
    const audit = await platformRows(
      'select action, target_type, target_id, tenant_id, meta from platform_audit where tenant_id = $1',
      [school.id],
    );
    expect(audit).toEqual([
      {
        action: 'tenant.renamed',
        target_type: 'tenant',
        target_id: school.id,
        tenant_id: school.id,
        meta: { from: 'Old Name', to: 'New Name' },
      },
    ]);
  });

  it('changes nothing and answers false when the name is no longer the one expected (Task 14 review)', async () => {
    const school = await insertTenant(withPlatform, { name: 'Renamed By Quad' });
    const renamed = await withTenant(school.id, (tx) =>
      definers.updateCurrentTenantName(tx, { expected: 'Name The Admin Saw', name: 'Admin Name' }),
    );
    expect(renamed).toBe(false);
    const names = await platformRows<{ name: string }>('select name from tenants where id = $1', [
      school.id,
    ]);
    expect(names).toEqual([{ name: 'Renamed By Quad' }]);
    const audit = await platformRows('select action from platform_audit where tenant_id = $1', [
      school.id,
    ]);
    expect(audit).toEqual([]);
  });

  it("never renames another school, even when given that school's name", async () => {
    const school = await insertTenant(withPlatform, { name: 'Own Name' });
    const renamed = await withTenant(school.id, (tx) =>
      definers.updateCurrentTenantName(tx, { expected: 'Kandy Test School', name: 'Taken Over' }),
    );
    expect(renamed).toBe(false);
    const names = await platformRows<{ id: string; name: string }>(
      'select id, name from tenants where id = any($1::uuid[]) order by name',
      [[school.id, schoolB.id]],
    );
    expect(names).toEqual([
      { id: schoolB.id, name: 'Kandy Test School' },
      { id: school.id, name: 'Own Name' },
    ]);
  });

  it('refuses without app.tenant_id and refuses a blank name', async () => {
    const cause = await failure(
      testDb().app.query(`select update_current_tenant_name('Anything', 'Else')`),
    );
    expect(cause).toMatchObject({ code: '42501' });
    const blank = await failure(
      withTenant(schoolA.id, (tx) =>
        definers.updateCurrentTenantName(tx, { expected: schoolA.name, name: '   ' }),
      ),
    );
    expect(blank).toMatchObject({ code: '22023' });
  });
});

describe('consume_signed_token', () => {
  it('is true the first time a nonce is used, then false', async () => {
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + HOUR_MS);
    await expect(
      definers.consumeSignedToken({ nonce, purpose: 'password_reset', expiresAt }),
    ).resolves.toBe(true);
    await expect(
      definers.consumeSignedToken({ nonce, purpose: 'password_reset', expiresAt }),
    ).resolves.toBe(false);
  });
});

describe('record_support_audit', () => {
  const entry = {
    action: 'user.role_changed',
    targetType: 'user',
    meta: { note: 'test' },
  } as const;

  it('records an active support session of the current school in platform_audit', async () => {
    const support = await insertSupportSession(withPlatform, quadStaff.id, schoolA.id);
    await withTenant(schoolA.id, (tx) =>
      definers.recordSupportAudit(tx, {
        ...entry,
        supportSessionId: support.id,
        targetId: personInA.id,
      }),
    );
    const audit = await platformRows(
      `select actor_platform_user_id, action, target_type, target_id, tenant_id, meta
       from platform_audit where meta->>'support_session_id' = $1`,
      [support.id],
    );
    expect(audit).toEqual([
      {
        actor_platform_user_id: quadStaff.id,
        action: 'user.role_changed',
        target_type: 'user',
        target_id: personInA.id,
        tenant_id: schoolA.id,
        meta: { note: 'test', support_session_id: support.id },
      },
    ]);
  });

  it('refuses a support session of another school and an ended one', async () => {
    const other = await insertSupportSession(withPlatform, quadStaff.id, schoolB.id);
    const ended = await insertSupportSession(withPlatform, quadStaff.id, schoolA.id, {
      endedAt: new Date(),
    });
    for (const support of [other, ended]) {
      const cause = await failure(
        withTenant(schoolA.id, (tx) =>
          definers.recordSupportAudit(tx, {
            ...entry,
            supportSessionId: support.id,
            targetId: null,
          }),
        ),
      );
      expect(cause).toMatchObject({ code: '42501' });
    }
    const audit = await platformRows(
      `select 1 from platform_audit where meta->>'support_session_id' = any($1::text[])`,
      [[other.id, ended.id]],
    );
    expect(audit).toEqual([]);
  });
});

describe('current_support_visit', () => {
  it('names the Quad staff member of an active visit to the current school (the support banner)', async () => {
    const support = await insertSupportSession(withPlatform, quadStaff.id, schoolA.id);
    await expect(
      withTenant(schoolA.id, (tx) => definers.currentSupportVisit(tx, support.id)),
    ).resolves.toEqual({ platformUserName: quadStaff.name });
  });

  it('finds nothing for a visit to another school, an ended or expired visit, or without a school', async () => {
    const other = await insertSupportSession(withPlatform, quadStaff.id, schoolB.id);
    const ended = await insertSupportSession(withPlatform, quadStaff.id, schoolA.id, {
      endedAt: new Date(),
    });
    const expired = await insertSupportSession(withPlatform, quadStaff.id, schoolA.id, {
      expiresAt: new Date(Date.now() - 1000),
    });
    for (const visit of [other, ended, expired]) {
      await expect(
        withTenant(schoolA.id, (tx) => definers.currentSupportVisit(tx, visit.id)),
      ).resolves.toBeNull();
    }
    const { rows } = await testDb().app.query(`select * from current_support_visit($1)`, [
      other.id,
    ]);
    expect(rows).toEqual([]);
  });
});

describe('ensure_account_for_email', () => {
  it('refuses without app.tenant_id', async () => {
    const cause = await failure(
      testDb().app.query(`select * from ensure_account_for_email('new@example.test')`),
    );
    expect(cause).toMatchObject({ code: '42501' });
  });

  it('creates one active account for a new email and returns the same id the second time', async () => {
    const email = `invitee-${randomBytes(4).toString('hex')}@example.test`;
    const first = await withTenant(schoolA.id, (tx) => definers.ensureAccountForEmail(tx, email));
    const second = await withTenant(schoolB.id, (tx) =>
      definers.ensureAccountForEmail(tx, email.toUpperCase()),
    );
    expect(second).toBe(first);
    const rows = await platformRows('select id, status from accounts where email = $1', [email]);
    expect(rows).toEqual([{ id: first, status: 'active' }]);
  });

  it("returns an existing account's id, even from another school", async () => {
    const id = await withTenant(schoolA.id, (tx) =>
      definers.ensureAccountForEmail(tx, outsider.email ?? ''),
    );
    expect(id).toBe(outsider.id);
  });
});

describe('member_two_step_status', () => {
  it("under A returns A's members only, and drops B's user ids", async () => {
    const statuses = await withTenant(schoolA.id, (tx) =>
      definers.memberTwoStepStatus(tx, [
        personInA.id,
        colleagueInA.id,
        outsiderInB.id,
        personInB.id,
      ]),
    );
    expect(new Map(statuses.map((s) => [s.userId, s.totpEnabled]))).toEqual(
      new Map([
        [personInA.id, true],
        [colleagueInA.id, false],
      ]),
    );
  });

  it('leaves the caller app.account_id as it was', async () => {
    const after = await withAccount(colleague.id, { tenantId: schoolA.id }, async (tx) => {
      await definers.memberTwoStepStatus(tx, [personInA.id]);
      const result = await tx.execute<{ account_id: string }>(
        sql`select current_setting('app.account_id', true) as account_id`,
      );
      return result.rows[0]?.account_id;
    });
    expect(after).toBe(colleague.id);
  });
});

describe('revoke_member_sessions', () => {
  async function revokedById(ids: readonly string[]): Promise<Map<string, boolean>> {
    const rows = await platformRows<{ id: string; revoked: boolean }>(
      'select id, revoked_at is not null as revoked from sessions where id = any($1::uuid[])',
      [ids],
    );
    return new Map(rows.map((row) => [row.id, row.revoked]));
  }

  it("under A revokes the member's A sessions and A refresh families, and leaves B's", async () => {
    const member = await insertAccount(withAccount);
    const inA = await insertUser(withTenant, schoolA.id, member.id);
    const inB = await insertUser(withTenant, schoolB.id, member.id);
    const active = (tenantId: string, userId: string) =>
      ({ stage: 'active', activeTenantId: tenantId, activeUserId: userId }) as const;
    const webA = await insertSession(withAccount, member.id, active(schoolA.id, inA.id));
    const mobileA = await insertSession(withAccount, member.id, {
      ...active(schoolA.id, inA.id),
      kind: 'mobile',
      tokenHash: null,
      refreshHash: randomTokenHash(),
    });
    const webB = await insertSession(withAccount, member.id, active(schoolB.id, inB.id));
    const mobileB = await insertSession(withAccount, member.id, {
      ...active(schoolB.id, inB.id),
      kind: 'mobile',
      tokenHash: null,
      refreshHash: randomTokenHash(),
    });
    const noSchool = await insertSession(withAccount, member.id);

    await withTenant(schoolA.id, (tx) => definers.revokeMemberSessions(tx, inA.id));

    expect(await revokedById([webA.id, mobileA.id, webB.id, mobileB.id, noSchool.id])).toEqual(
      new Map([
        [webA.id, true],
        [mobileA.id, true],
        [webB.id, false],
        [mobileB.id, false],
        [noSchool.id, false],
      ]),
    );
  });

  it("does nothing under A for B's user id", async () => {
    const session = await insertSession(withAccount, outsider.id, {
      stage: 'active',
      activeTenantId: schoolB.id,
      activeUserId: outsiderInB.id,
    });
    await withTenant(schoolA.id, (tx) => definers.revokeMemberSessions(tx, outsiderInB.id));
    expect(await revokedById([session.id])).toEqual(new Map([[session.id, false]]));
  });
});

describe("clear_member_preview (Task 13: a role change ends the member's role preview)", () => {
  async function previewOf(sessionId: string) {
    const rows = await platformRows<{
      preview_role_id: string | null;
      preview_sample_user_id: string | null;
    }>('select preview_role_id, preview_sample_user_id from sessions where id = $1', [sessionId]);
    return rows[0];
  }

  it("under A clears the member's previews in A only, and leaves B's", async () => {
    const member = await insertAccount(withAccount);
    const inA = await insertUser(withTenant, schoolA.id, member.id);
    const inB = await insertUser(withTenant, schoolB.id, member.id);
    const roleA = await insertRole(withTenant, schoolA.id);
    const roleB = await insertRole(withTenant, schoolB.id);
    const sessionA = await insertSession(withAccount, member.id, {
      stage: 'active',
      activeTenantId: schoolA.id,
      activeUserId: inA.id,
      previewRoleId: roleA.id,
      previewSampleUserId: colleagueInA.id,
    });
    const sessionB = await insertSession(withAccount, member.id, {
      stage: 'active',
      activeTenantId: schoolB.id,
      activeUserId: inB.id,
      previewRoleId: roleB.id,
    });

    await withTenant(schoolA.id, (tx) => definers.clearMemberPreview(tx, inA.id));

    expect(await previewOf(sessionA.id)).toEqual({
      preview_role_id: null,
      preview_sample_user_id: null,
    });
    expect(await previewOf(sessionB.id)).toEqual({
      preview_role_id: roleB.id,
      preview_sample_user_id: null,
    });
  });

  it("does nothing under A for B's user id", async () => {
    const role = await insertRole(withTenant, schoolB.id);
    const session = await insertSession(withAccount, outsider.id, {
      stage: 'active',
      activeTenantId: schoolB.id,
      activeUserId: outsiderInB.id,
      previewRoleId: role.id,
    });
    await withTenant(schoolA.id, (tx) => definers.clearMemberPreview(tx, outsiderInB.id));
    expect(await previewOf(session.id)).toMatchObject({ preview_role_id: role.id });
  });

  it('refuses without app.tenant_id', async () => {
    const refused = await failure(
      testDb().app.query('select clear_member_preview($1)', [personInA.id]),
    );
    expect(refused).toMatchObject({ code: '42501' });
  });

  it("leaves the caller's app.account_id as it was", async () => {
    const value = await withTenant(schoolA.id, async (tx) => {
      await tx.execute(sql`select set_config('app.account_id', ${person.id}, true)`);
      await definers.clearMemberPreview(tx, colleagueInA.id);
      const { rows } = await tx.execute<{ value: string }>(
        sql`select current_setting('app.account_id', true) as value`,
      );
      return rows[0]?.value;
    });
    expect(value).toBe(person.id);
  });
});

describe('member_account_email (Task 13 fix round 1, M2: where an admin reset is sent)', () => {
  it("under A gives an A member's account email, and nothing for B's member", async () => {
    const [mine, theirs] = await withTenant(schoolA.id, async (tx) => [
      await definers.memberAccountEmail(tx, colleagueInA.id),
      await definers.memberAccountEmail(tx, outsiderInB.id),
    ]);
    expect(mine).toBe(colleague.email);
    expect(theirs).toBeNull();
  });

  it('refuses without app.tenant_id', async () => {
    const refused = await failure(
      testDb().app.query('select member_account_email($1)', [colleagueInA.id]),
    );
    expect(refused).toMatchObject({ code: '42501' });
  });
});

describe('member_has_other_memberships (Task 13 fix round 1, I3: did this invite create the account?)', () => {
  it('is true for an account with a membership in another school, of any kind or status', async () => {
    const shared = await insertAccount(withAccount);
    const inA = await insertUser(withTenant, schoolA.id, shared.id, { status: 'invited' });
    await insertUser(withTenant, schoolB.id, shared.id, {
      kind: 'guardian',
      status: 'deactivated',
    });
    const only = await insertAccount(withAccount);
    const onlyInA = await insertUser(withTenant, schoolA.id, only.id, { status: 'invited' });
    const [sharedResult, onlyResult, theirs] = await withTenant(schoolA.id, async (tx) => [
      await definers.memberHasOtherMemberships(tx, inA.id),
      await definers.memberHasOtherMemberships(tx, onlyInA.id),
      await definers.memberHasOtherMemberships(tx, outsiderInB.id),
    ]);
    expect(sharedResult).toBe(true);
    expect(onlyResult).toBe(false);
    // Another school's member is not this school's to ask about: false, never its answer.
    expect(theirs).toBe(false);
  });

  it("gives false for another school's member who does have other memberships (Task 13 review)", async () => {
    // B's member also belongs to a third school, so their own answer is true: a false from A
    // proves the lookup is held to A's members, not that the account has nothing else.
    const third = await insertTenant(withPlatform);
    const shared = await insertAccount(withAccount);
    const inB = await insertUser(withTenant, schoolB.id, shared.id);
    await insertUser(withTenant, third.id, shared.id);
    const fromB = await withTenant(schoolB.id, (tx) =>
      definers.memberHasOtherMemberships(tx, inB.id),
    );
    const fromA = await withTenant(schoolA.id, (tx) =>
      definers.memberHasOtherMemberships(tx, inB.id),
    );
    expect(fromB).toBe(true);
    expect(fromA).toBe(false);
  });

  it('refuses without app.tenant_id', async () => {
    const refused = await failure(
      testDb().app.query('select member_has_other_memberships($1)', [colleagueInA.id]),
    );
    expect(refused).toMatchObject({ code: '42501' });
  });
});

describe('with_account_scope (R-definer-account)', () => {
  /** Runs `statement` as quad_owner with both settings, and reports app.account_id afterwards. */
  async function ownerCall(
    tenantId: string,
    accountId: string,
    statement: string,
  ): Promise<{ error: unknown; accountAfter: string | undefined }> {
    const client = await testDb().owner.connect();
    try {
      await client.query('begin');
      await client.query(
        `select set_config('app.tenant_id', $1, true), set_config('app.account_id', $2, true)`,
        [tenantId, colleague.id],
      );
      await client.query('savepoint call');
      let error: unknown;
      try {
        await client.query('select * from with_account_scope($1, $2)', [accountId, statement]);
      } catch (caught) {
        error = caught;
        await client.query('rollback to savepoint call');
      }
      const { rows } = await client.query<{ account_id: string }>(
        `select current_setting('app.account_id', true) as account_id`,
      );
      return { error, accountAfter: rows[0]?.account_id };
    } finally {
      await client.query('rollback');
      client.release();
    }
  }

  it("restores the caller's app.account_id after a successful call", async () => {
    const result = await ownerCall(
      schoolA.id,
      person.id,
      `select to_jsonb(current_setting('app.account_id', true))`,
    );
    expect(result).toEqual({ error: undefined, accountAfter: colleague.id });
  });

  it("restores the caller's app.account_id after a failing call", async () => {
    const result = await ownerCall(schoolA.id, person.id, 'select to_jsonb(1 / 0)');
    expect(result.error).toMatchObject({ code: '22012' });
    expect(result.accountAfter).toBe(colleague.id);
  });

  it('refuses an account that is not a member of app.tenant_id', async () => {
    const result = await ownerCall(schoolA.id, outsider.id, `select to_jsonb(1)`);
    expect(result.error).toMatchObject({ code: '42501' });
    expect(result.accountAfter).toBe(colleague.id);
  });
});

describe('D16 stubs', () => {
  it('tenant_by_embed_key and tenant_by_gateway_account return no rows yet', async () => {
    await expect(definers.tenantByEmbedKey('any-key')).resolves.toBeNull();
    await expect(definers.tenantByGatewayAccount('payhere', 'merchant-1')).resolves.toBeNull();
  });
});
