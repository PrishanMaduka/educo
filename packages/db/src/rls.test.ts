import { describe, expect, it } from 'vitest';

import { accountRlsSql, tenantRlsSql } from './rls';

describe('tenantRlsSql', () => {
  it('enables and forces RLS, adds the tenant policy for reads and writes, and grants DML to quad_app', () => {
    const tenantMatch = `tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`;
    expect(tenantRlsSql('attendance_marks')).toBe(
      [
        'ALTER TABLE "attendance_marks" ENABLE ROW LEVEL SECURITY;',
        '--> statement-breakpoint',
        'ALTER TABLE "attendance_marks" FORCE ROW LEVEL SECURITY;',
        '--> statement-breakpoint',
        `CREATE POLICY tenant_isolation ON "attendance_marks" FOR ALL USING (${tenantMatch}) WITH CHECK (${tenantMatch});`,
        '--> statement-breakpoint',
        'GRANT SELECT, INSERT, UPDATE, DELETE ON "attendance_marks" TO quad_app;',
        '',
      ].join('\n'),
    );
  });

  it.each(['', 'Students', 'students; drop table tenants', 'public.students', '1table', 'a"b'])(
    'refuses the unsafe table name %j',
    (name) => {
      expect(() => tenantRlsSql(name)).toThrow(/table name/);
    },
  );
});

describe('accountRlsSql', () => {
  it('enables and forces RLS, adds the account policy on the key column, and grants exactly the given privileges', () => {
    const accountMatch = `account_id = nullif(current_setting('app.account_id', true), '')::uuid`;
    expect(accountRlsSql('sessions', 'account_id', ['SELECT', 'INSERT', 'UPDATE'])).toBe(
      [
        'ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;',
        '--> statement-breakpoint',
        'ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;',
        '--> statement-breakpoint',
        `CREATE POLICY account_isolation ON "sessions" FOR ALL USING (${accountMatch}) WITH CHECK (${accountMatch});`,
        '--> statement-breakpoint',
        'GRANT SELECT, INSERT, UPDATE ON "sessions" TO quad_app;',
        '',
      ].join('\n'),
    );
  });

  it('keys the accounts table on id', () => {
    expect(accountRlsSql('accounts', 'id', ['SELECT'])).toContain(
      `USING (id = nullif(current_setting('app.account_id', true), '')::uuid)`,
    );
  });

  it.each([
    ['Accounts', 'id'],
    ['accounts; drop table tenants', 'id'],
    ['accounts', 'account_id = account_id or true'],
    ['accounts', 'Id'],
  ])('refuses the unsafe identifiers %j, %j', (table, key) => {
    expect(() => accountRlsSql(table, key, ['SELECT'])).toThrow(/Unsafe identifier/);
  });

  it('refuses an empty privilege list', () => {
    expect(() => accountRlsSql('accounts', 'id', [])).toThrow(/at least one privilege/);
  });
});
