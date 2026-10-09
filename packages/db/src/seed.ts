import { randomBytes } from 'node:crypto';

import { hash } from '@node-rs/argon2';
import { ARGON2ID_PARAMETERS, PlanModule } from '@quad/contracts';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { createFieldCipher } from './crypto/field-cipher';
import * as schema from './schema';
import {
  SEED_PEOPLE,
  SEED_PLATFORM_USERS,
  SEED_SCHOOL_ACCESS,
  SEED_SYSTEM_ROLES,
  SEED_TENANTS,
} from './seed-data';

import type { FieldCipher } from './crypto/field-cipher';
import type { SeedSecrets } from './env';
import type { SeedPerson, SeedSchool } from './seed-data';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

type SeedTx = Parameters<Parameters<NodePgDatabase<typeof schema>['transaction']>[0]>[0];

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** A new authenticator secret: 20 random bytes in RFC 4648 base32, as authenticator apps take. */
function newTotpSecret(): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of randomBytes(20)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  return out;
}

/**
 * The sealed secret to store: the one already there while it still opens under this key (so a
 * re-seed never breaks an authenticator someone added), otherwise a new one.
 */
async function sealedTotpSecret(cipher: FieldCipher, existing: string | null): Promise<string> {
  if (existing !== null) {
    try {
      await cipher.decrypt(existing);
      return existing;
    } catch {
      // Sealed under another key: replace it.
    }
  }
  return cipher.encrypt(newTotpSecret());
}

const hashPassword = (password: string) => hash(password, ARGON2ID_PARAMETERS);

/** `quad_owner` is filtered by FORCE RLS too, so each school's and account's rows say whose. */
async function actAs(tx: SeedTx, setting: 'app.tenant_id' | 'app.account_id', id: string) {
  await tx.execute(sql`select set_config(${setting}, ${id}, true)`);
}

async function seedSchools(tx: SeedTx): Promise<void> {
  for (const key of Object.keys(SEED_TENANTS) as SeedSchool[]) {
    const tenant = SEED_TENANTS[key];
    await tx
      .insert(schema.tenants)
      .values(tenant)
      .onConflictDoUpdate({ target: schema.tenants.id, set: { ...tenant, updatedAt: sql`now()` } });
    const access = SEED_SCHOOL_ACCESS[key];
    await tx
      .insert(schema.tenantBranding)
      .values({ tenantId: tenant.id, brandColor: access.brandColor })
      .onConflictDoUpdate({
        target: schema.tenantBranding.tenantId,
        set: { brandColor: access.brandColor },
      });
    await tx
      .insert(schema.tenantSecurity)
      .values({ tenantId: tenant.id, twoStep: access.twoStep })
      .onConflictDoUpdate({
        target: schema.tenantSecurity.tenantId,
        set: { twoStep: access.twoStep },
      });
    const enabled: ReadonlySet<PlanModule> = new Set(access.modules);
    for (const module of PlanModule.options) {
      await tx
        .insert(schema.tenantModules)
        .values({ tenantId: tenant.id, module, enabled: enabled.has(module) })
        .onConflictDoUpdate({
          target: [schema.tenantModules.tenantId, schema.tenantModules.module],
          set: { enabled: enabled.has(module) },
        });
    }
  }
}

async function seedPlatformUsers(
  tx: SeedTx,
  secrets: SeedSecrets,
  cipher: FieldCipher,
): Promise<void> {
  for (const user of Object.values(SEED_PLATFORM_USERS)) {
    const [existing] = await tx
      .select({ totpSecretEnc: schema.platformUsers.totpSecretEnc })
      .from(schema.platformUsers)
      .where(eq(schema.platformUsers.id, user.id));
    const values = {
      ...user,
      passwordHash: await hashPassword(secrets.password),
      totpSecretEnc: await sealedTotpSecret(cipher, existing?.totpSecretEnc ?? null),
      totpEnabled: true,
      status: 'active' as const,
      lockedUntil: null,
    };
    await tx
      .insert(schema.platformUsers)
      .values(values)
      .onConflictDoUpdate({ target: schema.platformUsers.id, set: values });
  }
}

async function seedAccount(
  tx: SeedTx,
  person: SeedPerson,
  secrets: SeedSecrets,
  cipher: FieldCipher,
): Promise<void> {
  await actAs(tx, 'app.account_id', person.accountId);
  const account = {
    id: person.accountId,
    email: person.email ?? null,
    phoneE164: person.phoneE164 ?? null,
    status: 'active' as const,
    lockedUntil: null,
  };
  await tx
    .insert(schema.accounts)
    .values(account)
    .onConflictDoUpdate({ target: schema.accounts.id, set: account });
  if (!person.staff) return;
  const [existing] = await tx
    .select({ totpSecretEnc: schema.credentials.totpSecretEnc })
    .from(schema.credentials)
    .where(eq(schema.credentials.accountId, person.accountId));
  const credential = {
    accountId: person.accountId,
    passwordHash: await hashPassword(secrets.password),
    totpSecretEnc: await sealedTotpSecret(cipher, existing?.totpSecretEnc ?? null),
    totpEnabled: true,
  };
  await tx
    .insert(schema.credentials)
    .values(credential)
    .onConflictDoUpdate({ target: schema.credentials.accountId, set: credential });
}

/** One school's settings row, system roles, seeded memberships and their roles. */
async function seedSchoolPeople(tx: SeedTx, school: SeedSchool): Promise<void> {
  const tenantId = SEED_TENANTS[school].id;
  await actAs(tx, 'app.tenant_id', tenantId);
  // The spec's defaults; a settings row someone has edited is left as it is.
  await tx.insert(schema.schoolSettings).values({ tenantId }).onConflictDoNothing();

  const roleIds = new Map<string, string>();
  for (const [key, role] of Object.entries(SEED_SYSTEM_ROLES)) {
    const values = { tenantId, key, name: role.name, scope: role.scope, system: true };
    const [row] = await tx
      .insert(schema.roles)
      .values(values)
      .onConflictDoUpdate({ target: [schema.roles.tenantId, schema.roles.key], set: values })
      .returning({ id: schema.roles.id });
    if (row) roleIds.set(key, row.id);
  }

  for (const person of Object.values(SEED_PEOPLE) as readonly SeedPerson[]) {
    for (const membership of person.memberships.filter((m) => m.school === school)) {
      const user = {
        id: membership.userId,
        tenantId,
        accountId: person.accountId,
        kind: membership.kind,
        name: person.name,
        email: person.email ?? null,
        phoneE164: person.phoneE164 ?? null,
        status: 'active' as const,
        deletedAt: null,
      };
      await tx
        .insert(schema.users)
        .values({ ...user, acceptedAt: sql`now()` })
        .onConflictDoUpdate({ target: schema.users.id, set: user });
      await tx
        .delete(schema.userRoles)
        .where(
          and(
            eq(schema.userRoles.tenantId, tenantId),
            eq(schema.userRoles.userId, membership.userId),
          ),
        );
      for (const [index, key] of membership.roles.entries()) {
        const roleId = roleIds.get(key);
        if (roleId === undefined) throw new Error(`The seed has no ${key} role.`);
        await tx
          .insert(schema.userRoles)
          .values({ tenantId, userId: membership.userId, roleId, primary: index === 0 });
      }
    }
  }
}

/**
 * Upserts the seed data as `quad_owner`, in one transaction (D24). Seeding is a deploy-time tool
 * like migrations, not a console action, so it does not go through `withPlatform` (whose writes
 * belong in `platform_audit`). FORCE RLS filters the owner too, so the seed sets
 * `app.tenant_id` before each school's tenant rows and `app.account_id` before each account's.
 *
 * It writes the two sample schools (branding, plan modules, two-step rule, settings defaults and
 * the seven system roles), the two console users and the sample people with their memberships.
 * Staff and console users get `secrets.password` (Argon2id) and an enabled authenticator sealed
 * with `FIELD_ENCRYPTION_KEY`, so the local fixed code passes two-step. Running it again restores
 * the seed values, keeps each authenticator secret that still opens, and leaves edited settings.
 */
export async function seedDatabase(ownerUrl: string, secrets: SeedSecrets): Promise<void> {
  if (secrets.password === '') {
    throw new Error('SEED_PASSWORD is required: the seeded people sign in with it.');
  }
  const cipher = createFieldCipher(secrets.fieldEncryptionKey);
  const client = new pg.Client({ connectionString: ownerUrl, application_name: 'quad-seed' });
  await client.connect();
  try {
    await drizzle({ client, schema }).transaction(async (tx) => {
      await seedSchools(tx);
      await seedPlatformUsers(tx, secrets, cipher);
      for (const person of Object.values(SEED_PEOPLE) as readonly SeedPerson[]) {
        await seedAccount(tx, person, secrets, cipher);
      }
      for (const school of Object.keys(SEED_TENANTS) as SeedSchool[]) {
        await seedSchoolPeople(tx, school);
      }
    });
  } finally {
    await client.end();
  }
}
