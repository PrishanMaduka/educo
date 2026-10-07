import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const ownerUrl =
  process.env.DATABASE_OWNER_URL ?? 'postgres://quad_owner:quad_owner@localhost:5432/quad';

const query = async <Row extends object>(sql: string): Promise<Row[]> => {
  const client = new Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    return (await client.query<Row>(sql)).rows;
  } finally {
    await client.end();
  }
};

interface RoleRow {
  rolname: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  can_create: boolean;
}

describe('local services', () => {
  it('quad_app cannot bypass RLS and quad_platform can', async () => {
    const rows = await query<Pick<RoleRow, 'rolname' | 'rolbypassrls'>>(
      `select rolname, rolbypassrls from pg_roles where rolname in ('quad_app', 'quad_platform')`,
    );
    const byName = Object.fromEntries(rows.map((r) => [r.rolname, r.rolbypassrls]));
    expect(byName).toEqual({ quad_app: false, quad_platform: true });
  });

  // 01-roles.sql: quad_owner owns the database and schema (it runs migrations, so it has CREATE on
  // public) but is neither a superuser nor exempt from RLS; quad_app only uses what it is granted.
  it('no app role is a superuser, quad_owner cannot bypass RLS and quad_app cannot create', async () => {
    const rows = await query<RoleRow>(
      `select rolname, rolsuper, rolbypassrls, has_schema_privilege(rolname, 'public', 'CREATE') as can_create
         from pg_roles where rolname in ('quad_app', 'quad_owner') order by rolname`,
    );
    expect(rows).toEqual([
      { rolname: 'quad_app', rolsuper: false, rolbypassrls: false, can_create: false },
      { rolname: 'quad_owner', rolsuper: false, rolbypassrls: false, can_create: true },
    ]);
  });
});
