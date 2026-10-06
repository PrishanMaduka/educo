import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
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

  it('.env.example lists every variable named in spec 02', () => {
    const spec = readFileSync(resolve(root, 'docs/spec/02-architecture.md'), 'utf8');
    const section = spec.split(/^### Environment variables\s*$/m)[1]?.split(/^#{1,3} /m)[0] ?? '';
    const rows = section.split('\n').filter((l) => l.startsWith('|') && !/^\|\s*(Area|-)/.test(l));
    const names = rows.flatMap((row) => {
      const variables = row.split('|')[2] ?? '';
      return [...variables.matchAll(/`([A-Z][A-Z0-9]*_[A-Z0-9_]+)`/g)].map((m) => m[1] as string);
    });
    expect(names.length).toBeGreaterThan(50);

    const env = readFileSync(resolve(root, '.env.example'), 'utf8');
    const keys = env
      .split('\n')
      .map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l)?.[1])
      .filter((k): k is string => Boolean(k));
    expect(names.filter((n) => !keys.includes(n))).toEqual([]);
    expect(keys).toEqual(names);
  });
});
