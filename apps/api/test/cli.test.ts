import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { LOCAL_SEED_PASSWORD } from '@quad/contracts';
import { afterAll, describe, expect, it } from 'vitest';

import { adminConnectionFromEnv, parseRoleFromUrl } from '../src/cli/db-bootstrap';
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

describe('adminConnectionFromEnv', () => {
  const parts = {
    DATABASE_ADMIN_HOST: 'quad-staging.abc.ap-south-1.rds.amazonaws.com',
    DATABASE_ADMIN_PORT: '5432',
    DATABASE_ADMIN_USER: 'quad_admin',
    DATABASE_ADMIN_PASSWORD: 'p@ss:/w?rd#%&x',
  };
  const readCa = (): string => 'RDS CA PEM';

  it('uses DATABASE_ADMIN_URL when it is set, even beside the parts', () => {
    expect(
      adminConnectionFromEnv(
        { ...parts, DATABASE_ADMIN_URL: 'postgres://postgres:postgres@localhost:5432/quad' },
        readCa,
      ),
    ).toBe('postgres://postgres:postgres@localhost:5432/quad');
  });

  it('builds a client config from the parts, with TLS verified against the RDS bundle', () => {
    expect(adminConnectionFromEnv({ ...parts, DATABASE_ADMIN_URL: '' }, readCa)).toEqual({
      host: 'quad-staging.abc.ap-south-1.rds.amazonaws.com',
      port: 5432,
      user: 'quad_admin',
      password: 'p@ss:/w?rd#%&x',
      ssl: { rejectUnauthorized: true, ca: 'RDS CA PEM' },
    });
  });

  it('names every missing part and never echoes the password', () => {
    let message = '';
    try {
      adminConnectionFromEnv(
        { ...parts, DATABASE_ADMIN_HOST: undefined, DATABASE_ADMIN_USER: '' },
        readCa,
      );
    } catch (error) {
      message = String(error);
    }
    expect(message).toMatch(/missing: DATABASE_ADMIN_HOST, DATABASE_ADMIN_USER\.$/);
    expect(message).not.toContain(parts.DATABASE_ADMIN_PASSWORD);
  });

  it.each([['0'], ['65536'], ['54x'], ['-1']])('refuses DATABASE_ADMIN_PORT=%s', (port) => {
    expect(() => adminConnectionFromEnv({ ...parts, DATABASE_ADMIN_PORT: port }, readCa)).toThrow(
      /DATABASE_ADMIN_PORT must be a whole number from 1 to 65535/,
    );
  });

  it('does not read the CA bundle when the URL is used', () => {
    const failingRead = (): string => {
      throw new Error('should not read');
    };
    expect(() =>
      adminConnectionFromEnv({ DATABASE_ADMIN_URL: 'postgres://u:p@h/quad' }, failingRead),
    ).not.toThrow();
  });
});

describe('db-bootstrap command', () => {
  it('exits 1 and names the missing part, without the password, when a part is missing', () => {
    const password = 'Sup3r:s3cret@pass/word';
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', resolve(__dirname, '../src/cli/db-bootstrap.ts')],
      {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          DATABASE_OWNER_URL: 'postgres://quad_owner:o@db.internal:5432/quad',
          DATABASE_URL: 'postgres://quad_app:a@proxy.internal:5432/quad',
          DATABASE_PLATFORM_URL: 'postgres://quad_platform:p@proxy.internal:5432/quad',
          DATABASE_ADMIN_PORT: '5432',
          DATABASE_ADMIN_USER: 'quad_admin',
          DATABASE_ADMIN_PASSWORD: password,
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/db-bootstrap failed: .*DATABASE_ADMIN_HOST/);
    expect(result.stderr + result.stdout).not.toContain(password);
    // A child process that loads tsx: slow under load (a full verify beside infra-check timed out at 5 s).
  }, 30_000);
});

describe('seedRefusal', () => {
  const STAGING_PASSWORD = 'a-real-staging-password';

  it.each([['production'], ['Production'], ['prod'], [undefined], [''], ['Local']])(
    'refuses APP_ENV=%j',
    (appEnv) => {
      expect(seedRefusal({ APP_ENV: appEnv, SEED_PASSWORD: STAGING_PASSWORD })).toMatch(
        /only runs when APP_ENV is local or staging/,
      );
    },
  );

  it('allows local with the placeholder, but never without a seed password (Task 17)', () => {
    expect(seedRefusal({ APP_ENV: 'local', SEED_PASSWORD: LOCAL_SEED_PASSWORD })).toBeNull();
    expect(seedRefusal({ APP_ENV: 'local' })).toBe(
      'SEED_PASSWORD is required when APP_ENV is local.',
    );
  });

  it('allows staging with a real seed password', () => {
    expect(seedRefusal({ APP_ENV: 'staging', SEED_PASSWORD: STAGING_PASSWORD })).toBeNull();
  });

  it('refuses staging without a seed password (the hand-set placeholder is empty)', () => {
    expect(seedRefusal({ APP_ENV: 'staging', SEED_PASSWORD: '' })).toBe(
      'SEED_PASSWORD is required when APP_ENV is staging.',
    );
  });

  it('refuses staging with the published local placeholder', () => {
    expect(seedRefusal({ APP_ENV: 'staging', SEED_PASSWORD: LOCAL_SEED_PASSWORD })).toBe(
      'SEED_PASSWORD is the published local value; set a real one.',
    );
  });
});

describe('seed command', () => {
  it('exits 1 naming FIELD_ENCRYPTION_KEY when it is missing, before touching the database', () => {
    const password = 'Sup3r:s3cret-seed-pass';
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', resolve(__dirname, '../src/cli/seed.ts')],
      {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          APP_ENV: 'staging',
          SEED_PASSWORD: password,
          // Unresolvable on purpose: the command must stop before it connects.
          DATABASE_OWNER_URL: 'postgres://quad_owner:o@db.invalid:5432/quad',
        },
      },
    );
    expect(result.stderr).toBe('seed failed: FIELD_ENCRYPTION_KEY is required.\n');
    expect(result.status).toBe(1);
    expect(result.stderr + result.stdout).not.toContain(password);
    // A child process that loads tsx, as the db-bootstrap test above.
  }, 30_000);
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
