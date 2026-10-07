import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { parseRoleFromUrl } from '../src/cli/db-bootstrap';
import { seedRefusal } from '../src/cli/seed';

describe('parseRoleFromUrl', () => {
  it('reads the URL-decoded user and password', () => {
    expect(parseRoleFromUrl('postgres://quad_app:p%40ss@h:5432/quad')).toEqual({
      name: 'quad_app',
      password: 'p@ss',
    });
  });

  it('refuses a URL without a user or password, without echoing the URL', () => {
    expect(() => parseRoleFromUrl('postgres://h:5432/quad')).toThrow(/user and a password/);
    expect(() => parseRoleFromUrl('postgres://quad_app:secret-value@h/quad')).not.toThrow();
    try {
      parseRoleFromUrl('postgres://quad_app@secret-host/quad');
    } catch (error) {
      expect(String(error)).not.toContain('secret-host');
    }
  });
});

describe('seedRefusal', () => {
  it('refuses production', () => {
    expect(seedRefusal('production')).toMatch(/production/);
  });

  it.each([['local'], ['staging'], [undefined]])('allows %s', (appEnv) => {
    expect(seedRefusal(appEnv)).toBeNull();
  });
});

describe('copy-migrations', () => {
  const out = mkdtempSync(join(tmpdir(), 'quad-dist-'));
  afterAll(() => {
    rmSync(out, { recursive: true, force: true });
  });

  it('copies the Drizzle migrations and their journal into the dist folder', () => {
    execFileSync(process.execPath, [resolve(__dirname, '../scripts/copy-migrations.mjs'), out]);
    expect(existsSync(join(out, 'migrations/meta/_journal.json'))).toBe(true);
    expect(existsSync(join(out, 'migrations/0000_tenants.sql'))).toBe(true);
  });
});
