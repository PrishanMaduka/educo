import { randomBytes } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bootstrapRoles, withDatabaseName } from '../src/admin';

import type { RoleCredentials } from '../src/admin';

/** The compose superuser (`DATABASE_ADMIN_URL` in `.env.example`). */
const ADMIN_URL =
  process.env.DATABASE_ADMIN_URL !== undefined && process.env.DATABASE_ADMIN_URL !== ''
    ? process.env.DATABASE_ADMIN_URL
    : 'postgres://postgres:postgres@localhost:5432/quad';

const suffix = randomBytes(5).toString('hex');
const database = `qbt_${suffix}`;
const secret = (): string => randomBytes(12).toString('hex');
const roles = {
  owner: { name: `qbt_owner_${suffix}`, password: secret() },
  app: { name: `qbt_app_${suffix}`, password: secret() },
  platform: { name: `qbt_platform_${suffix}`, password: secret() },
};

async function asAdmin<T>(url: string, run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

function urlFor(role: RoleCredentials): string {
  const url = new URL(withDatabaseName(ADMIN_URL, database));
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

describe('bootstrapRoles', () => {
  beforeAll(async () => {
    await asAdmin(ADMIN_URL, async (client) => client.query(`create database ${database}`));
    await bootstrapRoles(ADMIN_URL, roles, database);
    await bootstrapRoles(ADMIN_URL, roles, database);
  });

  afterAll(async () => {
    await asAdmin(ADMIN_URL, async (client) => {
      await client.query(`drop database if exists ${database} with (force)`);
      for (const role of Object.values(roles)) {
        await client.query(`drop role if exists ${role.name}`);
      }
    });
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
});
