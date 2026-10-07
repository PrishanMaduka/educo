import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { parseRoleFromUrl } from '../src/cli/db-bootstrap';
import { redact } from '../src/cli/run-command';
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
  it.each([['production'], ['Production'], ['prod'], [undefined], [''], ['Local']])(
    'refuses APP_ENV=%j',
    (appEnv) => {
      expect(seedRefusal(appEnv)).toMatch(/only runs when APP_ENV is local or staging/);
    },
  );

  it.each([['local'], ['staging']])('allows %s', (appEnv) => {
    expect(seedRefusal(appEnv)).toBeNull();
  });
});

describe('redact', () => {
  it('removes connection URLs', () => {
    expect(redact(new Error('cannot reach postgres://u:p@db.internal:5432/quad now'))).toBe(
      'cannot reach <url> now',
    );
  });

  it('removes user:password@host without a scheme', () => {
    const text = redact(new Error('bad target quad_app:hunter2@db.internal:5432/quad'));
    expect(text).not.toContain('hunter2');
    expect(text).toBe('bad target <credentials>');
  });

  it('falls back to the error code when the message is empty', () => {
    const error = Object.assign(new Error(''), { code: 'ECONNREFUSED' });
    expect(redact(error)).toBe('ECONNREFUSED');
  });

  it('falls back to the first inner error of an AggregateError', () => {
    const error = new AggregateError([new Error('connect ECONNREFUSED 127.0.0.1:5432')], '');
    expect(redact(error)).toBe('connect ECONNREFUSED 127.0.0.1:5432');
  });

  it('says the error was empty when nothing else is known', () => {
    expect(redact(new Error(''))).toBe('unknown error');
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
