import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const ownerUrl =
  process.env.DATABASE_OWNER_URL ?? 'postgres://quad_owner:quad_owner@localhost:5432/quad';

describe('local services', () => {
  it('quad_app cannot bypass RLS and quad_platform can', async () => {
    const client = new Client({ connectionString: ownerUrl });
    await client.connect();
    try {
      const { rows } = await client.query<{ rolname: string; rolbypassrls: boolean }>(
        `select rolname, rolbypassrls from pg_roles where rolname in ('quad_app', 'quad_platform')`,
      );
      const byName = Object.fromEntries(rows.map((r) => [r.rolname, r.rolbypassrls]));
      expect(byName).toEqual({ quad_app: false, quad_platform: true });
    } finally {
      await client.end();
    }
  });
});
