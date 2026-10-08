import { describe, expect, it } from 'vitest';

import {
  checkDeployedLock,
  lockedPackages,
  packageKeyFromPnpmDir,
} from '../check-deployed-lock.mjs';

const LOCK = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

importers:

  apps/api:
    dependencies:
      zod:
        specifier: 3.25.76
        version: 3.25.76

packages:

  '@sentry/core@11.5.0':
    resolution: {integrity: sha512-x}

  drizzle-orm@0.45.3:
    resolution: {integrity: sha512-y}
    peerDependencies:
      pg: '>=8'

  zod@3.25.76:
    resolution: {integrity: sha512-z}

snapshots:

  zod@3.25.77: {}
`;

describe('lockedPackages', () => {
  it('reads the keys under packages:, quoted or not, and nothing from other sections', () => {
    expect([...lockedPackages(LOCK)].sort()).toEqual([
      '@sentry/core@11.5.0',
      'drizzle-orm@0.45.3',
      'zod@3.25.76',
    ]);
  });
});

describe('packageKeyFromPnpmDir', () => {
  it.each([
    ['zod@3.25.76', 'zod@3.25.76'],
    ['@sentry+core@11.5.0', '@sentry/core@11.5.0'],
    ['drizzle-orm@0.45.3_@opentelemetry+api@1.9.1_pg@8.13.1', 'drizzle-orm@0.45.3'],
    ['@fastify+otel@0.21.1_@opentelemetry+api@1.9.1', '@fastify/otel@0.21.1'],
    ['next@15.5.27_@babel+core@7.29.7_oafywhergghawpq2pnq5iyuyqu', 'next@15.5.27'],
    ['pkg@1.0.0-beta.2', 'pkg@1.0.0-beta.2'],
  ])('%s is %s', (dir, key) => {
    expect(packageKeyFromPnpmDir(dir)).toBe(key);
  });

  it.each(['node_modules', 'lock.yaml', '.modules.yaml', 'no-version'])(
    '%s is not a package folder',
    (dir) => {
      expect(packageKeyFromPnpmDir(dir)).toBeUndefined();
    },
  );
});

describe('checkDeployedLock', () => {
  it('passes when every deployed package is in the lockfile', () => {
    expect(
      checkDeployedLock(LOCK, [
        'node_modules',
        'lock.yaml',
        'zod@3.25.76',
        '@sentry+core@11.5.0',
        'drizzle-orm@0.45.3_pg@8.13.1',
      ]),
    ).toEqual({ ok: true, checked: 3, unlocked: [] });
  });

  it('names a deployed version the lockfile does not have', () => {
    expect(checkDeployedLock(LOCK, ['zod@3.25.77', '@sentry+core@11.5.0'])).toEqual({
      ok: false,
      checked: 2,
      unlocked: ['zod@3.25.77'],
    });
  });

  it('fails when nothing was deployed, so a wrong folder cannot pass', () => {
    expect(checkDeployedLock(LOCK, ['node_modules', 'lock.yaml'])).toEqual({
      ok: false,
      checked: 0,
      unlocked: [],
    });
  });
});
