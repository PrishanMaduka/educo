import { randomBytes } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { bootstrapRoles, withDatabaseName } from '../src/admin';

import type { RoleCredentials } from '../src/admin';

/** The compose superuser (`DATABASE_ADMIN_URL` in `.env.example`). */
const ADMIN_URL =
  process.env.DATABASE_ADMIN_URL !== undefined && process.env.DATABASE_ADMIN_URL !== ''
    ? process.env.DATABASE_ADMIN_URL
    : 'postgres://postgres:postgres@localhost:5432/quad';

const secret = (): string => randomBytes(12).toString('hex');

/**
 * A database name and three role names that share a 10-hex-digit suffix. migration.test.ts
 * ignores `qbt_platform_<suffix>` when it checks that only quad_platform has BYPASSRLS.
 */
function scenario(): {
  database: string;
  roles: Record<'owner' | 'app' | 'platform', RoleCredentials>;
} {
  const suffix = randomBytes(5).toString('hex');
  return {
    database: `qbt_${suffix}`,
    roles: {
      owner: { name: `qbt_owner_${suffix}`, password: secret() },
      app: { name: `qbt_app_${suffix}`, password: secret() },
      platform: { name: `qbt_platform_${suffix}`, password: secret() },
    },
  };
}

const { database, roles } = scenario();

async function asAdmin<T>(url: string, run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

function urlFor(role: RoleCredentials, db: string = database): string {
  const url = new URL(withDatabaseName(ADMIN_URL, db));
  url.username = role.name;
  url.password = role.password;
  return url.toString();
}

async function canConnect(role: RoleCredentials): Promise<boolean> {
  try {
    await asAdmin(urlFor(role), async (client) => client.query('select 1'));
    return true;
  } catch {
    return false;
  }
}

async function dropScenario(s: ReturnType<typeof scenario>): Promise<void> {
  await asAdmin(ADMIN_URL, async (client) => {
    await client.query(`drop database if exists ${s.database} with (force)`);
    for (const role of Object.values(s.roles)) {
      await client.query(`drop role if exists ${role.name}`);
    }
  });
}

describe('bootstrapRoles', () => {
  beforeAll(async () => {
    await asAdmin(ADMIN_URL, async (client) => client.query(`create database ${database}`));
    await bootstrapRoles(ADMIN_URL, roles, database);
    await bootstrapRoles(ADMIN_URL, roles, database);
  });

  afterAll(async () => {
    await dropScenario({ database, roles });
  });

  it('gives only the platform role BYPASSRLS, after running twice', async () => {
    const { rows } = await asAdmin(ADMIN_URL, async (client) =>
      client.query<{ rolname: string; rolbypassrls: boolean }>(
        'select rolname, rolbypassrls from pg_roles where rolname = any($1)',
        [Object.values(roles).map((role) => role.name)],
      ),
    );
    const bypass = Object.fromEntries(rows.map((row) => [row.rolname, row.rolbypassrls]));
    expect(bypass).toEqual({
      [roles.owner.name]: false,
      [roles.app.name]: false,
      [roles.platform.name]: true,
    });
  });

  it('lets the app role connect with its password', async () => {
    expect(await canConnect(roles.app)).toBe(true);
  });

  it('makes the owner role own the database and the public schema', async () => {
    const owners = await asAdmin(withDatabaseName(ADMIN_URL, database), async (client) => {
      const db = await client.query<{ owner: string }>(
        'select pg_get_userbyid(datdba) as owner from pg_database where datname = $1',
        [database],
      );
      const schema = await client.query<{ owner: string }>(
        "select pg_get_userbyid(nspowner) as owner from pg_namespace where nspname = 'public'",
      );
      return { database: db.rows[0]?.owner, schema: schema.rows[0]?.owner };
    });
    expect(owners).toEqual({ database: roles.owner.name, schema: roles.owner.name });
  });

  it('gives the platform role default privileges on owner tables and the app role none', async () => {
    await asAdmin(urlFor(roles.owner), async (client) =>
      client.query('create table bootstrap_probe (id int)'),
    );
    const privileges = await asAdmin(withDatabaseName(ADMIN_URL, database), async (client) => {
      const { rows } = await client.query<{ app: boolean; platform: boolean }>(
        `select has_table_privilege($1, 'public.bootstrap_probe', 'select') as app,
                has_table_privilege($2, 'public.bootstrap_probe', 'select') as platform`,
        [roles.app.name, roles.platform.name],
      );
      return rows[0];
    });
    expect(privileges).toEqual({ app: false, platform: true });
  });

  it('sets a changed password on a later run', async () => {
    const app = { ...roles.app, password: secret() };
    await bootstrapRoles(ADMIN_URL, { ...roles, app }, database);
    expect(await canConnect(app)).toBe(true);
    expect(await canConnect(roles.app)).toBe(false);
  });

  it('sends the passwords only as SCRAM verifiers, never as plaintext', async () => {
    const app = { ...roles.app, password: secret() };
    const query = vi.spyOn(pg.Client.prototype, 'query');
    try {
      await bootstrapRoles(ADMIN_URL, { ...roles, app }, database);
      const sent = query.mock.calls.map((call) => JSON.stringify(call));
      expect(sent.some((text) => text.includes('SCRAM-SHA-256$4096:'))).toBe(true);
      for (const role of [roles.owner, app, roles.platform]) {
        expect(sent.filter((text) => text.includes(role.password))).toEqual([]);
      }
    } finally {
      query.mockRestore();
    }
    expect(await canConnect(app)).toBe(true);
  });
});

describe('bootstrapRoles refuses unsafe existing roles', () => {
  const superApp = scenario();
  const memberApp = scenario();

  beforeAll(async () => {
    await asAdmin(ADMIN_URL, async (client) => {
      for (const s of [superApp, memberApp]) {
        await client.query(`create database ${s.database}`);
      }
      await client.query(`create role ${superApp.roles.app.name} login superuser`);
      await client.query(`create role ${memberApp.roles.owner.name} login nobypassrls`);
      await client.query(`create role ${memberApp.roles.app.name} login nobypassrls`);
      await client.query(`grant ${memberApp.roles.owner.name} to ${memberApp.roles.app.name}`);
    });
  });

  afterAll(async () => {
    await dropScenario(superApp);
    await dropScenario(memberApp);
  });

  it('throws when the app role is a superuser', async () => {
    await expect(bootstrapRoles(ADMIN_URL, superApp.roles, superApp.database)).rejects.toThrow(
      /must not be a superuser/,
    );
  });

  it('throws when the app role is a member of the owner role', async () => {
    await expect(bootstrapRoles(ADMIN_URL, memberApp.roles, memberApp.database)).rejects.toThrow(
      /quad_app must not be a member of/,
    );
  });
});
