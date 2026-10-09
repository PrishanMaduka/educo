import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { missingToolchainAction } from '../flutter.mjs';

const root = resolve(__dirname, '../..');

describe('missingToolchainAction', () => {
  it.each([
    [{}, 'skip'],
    [{ CI: '' }, 'skip'],
    [{ CI: 'false' }, 'skip'],
    [{ CI: '0' }, 'skip'],
    [{ CI: 'true' }, 'fail'],
    [{ CI: '1' }, 'fail'],
    [{ CI: 'yes' }, 'fail'],
    [{ QUAD_REQUIRE_FLUTTER: '1' }, 'fail'],
    [{ QUAD_REQUIRE_FLUTTER: '0' }, 'skip'],
    [{ CI: 'false', QUAD_REQUIRE_FLUTTER: '1' }, 'fail'],
  ])('%j → %s', (env, action) => {
    expect(missingToolchainAction(env)).toBe(action);
  });
});

describe('scripts/flutter.mjs without Flutter', () => {
  const run = (env: Record<string, string>) =>
    spawnSync(process.execPath, [join(root, 'scripts/flutter.mjs'), 'flutter', 'analyze'], {
      env: { PATH: mkdtempSync(join(tmpdir(), 'no-flutter-')), ...env },
      encoding: 'utf8',
    });

  it('skips loudly outside CI', () => {
    const result = run({});
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Flutter checks SKIPPED (no Flutter on PATH)');
  });

  it('fails in CI', () => {
    const result = run({ CI: 'true' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/fvm nor flutter/);
  });
});

describe('scripts/api-client.mjs without Dart', () => {
  let sandbox = '';
  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  it('fails before touching any file', () => {
    // A copy of the scripts in a scratch repo, with a pnpm stub that logs calls.
    sandbox = mkdtempSync(join(tmpdir(), 'api-client-'));
    mkdirSync(join(sandbox, 'scripts'));
    for (const file of ['api-client.mjs', 'flutter.mjs', 'parent-openapi.mjs']) {
      copyFileSync(join(root, 'scripts', file), join(sandbox, 'scripts', file));
    }
    const marker = join(sandbox, 'apps/parent/packages/quad_api/pubspec.yaml');
    mkdirSync(join(sandbox, 'apps/parent/packages/quad_api'), { recursive: true });
    writeFileSync(marker, 'name: quad_api\n');
    const bin = join(sandbox, 'bin');
    const log = join(sandbox, 'pnpm.log');
    mkdirSync(bin);
    writeFileSync(join(bin, 'pnpm'), `#!/bin/sh\necho "$@" >> "${log}"\n`);
    chmodSync(join(bin, 'pnpm'), 0o755);

    const result = spawnSync(process.execPath, [join(sandbox, 'scripts/api-client.mjs')], {
      env: { PATH: bin },
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Install Flutter (version in .fvmrc) to run pnpm api:client — it also generates the Dart client.',
    );
    expect(readFileSync(marker, 'utf8')).toBe('name: quad_api\n');
    expect(existsSync(log)).toBe(false);
  });
});
