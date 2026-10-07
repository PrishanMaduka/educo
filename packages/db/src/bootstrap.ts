import pg from 'pg';

import { withDatabaseName } from './env';

/** A database role's login name and password. */
export interface RoleCredentials {
  readonly name: string;
  readonly password: string;
}

/** The three roles of spec 02 (D17): owner (migrations), app (`withTenant`), platform. */
export interface BootstrapRoles {
  readonly owner: RoleCredentials;
  readonly app: RoleCredentials;
  readonly platform: RoleCredentials;
}

async function ensureRole(
  client: pg.Client,
  role: RoleCredentials,
  bypassRls: boolean,
): Promise<void> {
  const name = client.escapeIdentifier(role.name);
  const exists = await client.query('select 1 from pg_roles where rolname = $1', [role.name]);
  if (exists.rowCount === 0) {
    await client.query(`create role ${name} login ${bypassRls ? 'bypassrls' : 'nobypassrls'}`);
  }
  // Always set, so a rotated secret takes effect on the next run.
  await client.query(
    `alter role ${name} with login password ${client.escapeLiteral(role.password)}`,
  );
}

async function assertRlsAttributes(client: pg.Client, roles: BootstrapRoles): Promise<void> {
  const { rows } = await client.query<{ rolname: string; rolbypassrls: boolean }>(
    'select rolname, rolbypassrls from pg_roles where rolname = any($1)',
    [[roles.owner.name, roles.app.name, roles.platform.name]],
  );
  const bypass = new Map(rows.map((row) => [row.rolname, row.rolbypassrls]));
  if (bypass.get(roles.platform.name) !== true) {
    throw new Error(
      `quad_platform must have BYPASSRLS (role ${roles.platform.name}); withPlatform() depends on it.`,
    );
  }
  for (const [label, role] of [
    ['quad_app', roles.app],
    ['quad_owner', roles.owner],
  ] as const) {
    if (bypass.get(role.name) !== false) {
      throw new Error(
        `${label} must not have BYPASSRLS (role ${role.name}); row-level security would not apply.`,
      );
    }
  }
}

/**
 * Creates or updates the three database roles and their grants, as the RDS master user (or the
 * local `postgres` superuser). It mirrors `docker/postgres/init/01-roles.sql` and keeps the D24
 * grant rules: `quad_app` gets no default privileges, because `tenantRlsSql` grants it DML per
 * tenant table, so platform tables stay closed to it. Safe to run on every deploy.
 */
export async function bootstrapRoles(
  adminUrl: string,
  roles: BootstrapRoles,
  database: string,
): Promise<void> {
  const client = new pg.Client({
    connectionString: withDatabaseName(adminUrl, database),
    application_name: 'quad-db-bootstrap',
  });
  await client.connect();
  try {
    await ensureRole(client, roles.owner, false);
    await ensureRole(client, roles.app, false);
    await ensureRole(client, roles.platform, true);

    const db = client.escapeIdentifier(database);
    const owner = client.escapeIdentifier(roles.owner.name);
    const app = client.escapeIdentifier(roles.app.name);
    const platform = client.escapeIdentifier(roles.platform.name);

    // RDS's master user is not a superuser: it must be a member of the owner role to hand it
    // the database and to set default privileges on its behalf.
    await client.query(`grant ${owner} to current_user`);
    await client.query(`alter database ${db} owner to ${owner}`);
    await client.query(`alter schema public owner to ${owner}`);

    await client.query(`revoke all on database ${db} from public`);
    await client.query(`grant connect on database ${db} to ${owner}, ${app}, ${platform}`);
    await client.query(`grant usage on schema public to ${app}, ${platform}`);

    await client.query('create extension if not exists pg_trgm');
    await client.query('create extension if not exists citext');

    await client.query(
      `alter default privileges for role ${owner} in schema public ` +
        `grant select, insert, update, delete on tables to ${platform}`,
    );
    await client.query(
      `alter default privileges for role ${owner} in schema public ` +
        `grant usage, select on sequences to ${platform}`,
    );

    await assertRlsAttributes(client, roles);
  } finally {
    await client.end();
  }
}
