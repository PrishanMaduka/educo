import { describe, expect, it } from 'vitest';

import { tenantRlsSql } from './rls';

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
