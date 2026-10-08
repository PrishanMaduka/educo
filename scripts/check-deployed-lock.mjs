#!/usr/bin/env node
// Fails the api image build if `pnpm deploy` installed a package version the lockfile does not
// name (D28). pnpm 9's deploy resolves again instead of reusing pnpm-lock.yaml, so it could drift:
//   node scripts/check-deployed-lock.mjs <pnpm-lock.yaml> <deploy>/node_modules/.pnpm
// Each folder in `.pnpm` is `<name>@<version>` (scope `/` written as `+`), optionally followed by
// `_<peers>`; that `<name>@<version>` must be a key under `packages:` in the lockfile.
import { readdirSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * The `<name>@<version>` keys under the lockfile's top-level `packages:` section.
 * @param {string} lockText
 * @returns {Set<string>}
 */
export function lockedPackages(lockText) {
  /** @type {Set<string>} */
  const keys = new Set();
  let inPackages = false;
  for (const line of lockText.split('\n')) {
    if (/^\S/.test(line)) inPackages = line.trimEnd() === 'packages:';
    else if (inPackages) {
      const match = /^ {2}(?:'([^']+)'|([^\s'][^:]*)):\s*$/.exec(line);
      const key = match?.[1] ?? match?.[2];
      if (key !== undefined) keys.add(key);
    }
  }
  return keys;
}

/**
 * The lockfile key for a folder in `node_modules/.pnpm`, or undefined when the folder is not a
 * package (`node_modules`, `lock.yaml`, dot files).
 * @param {string} dir
 * @returns {string | undefined}
 */
export function packageKeyFromPnpmDir(dir) {
  const match = /^((?:@[^+@]+\+)?[^@+]+)@([^_]+)/.exec(dir);
  if (match === null || dir.startsWith('.')) return undefined;
  const [, name = '', version = ''] = match;
  return `${name.replace('+', '/')}@${version}`;
}

/**
 * @param {string} lockText
 * @param {string[]} pnpmDirs the folder names in `node_modules/.pnpm`
 * @returns {{ ok: boolean, checked: number, unlocked: string[] }}
 */
export function checkDeployedLock(lockText, pnpmDirs) {
  const locked = lockedPackages(lockText);
  const keys = pnpmDirs.flatMap((dir) => {
    const key = packageKeyFromPnpmDir(dir);
    return key === undefined ? [] : [key];
  });
  const unlocked = keys.filter((key) => !locked.has(key));
  return { ok: keys.length > 0 && unlocked.length === 0, checked: keys.length, unlocked };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const [lockPath, pnpmDir] = process.argv.slice(2);
  if (lockPath === undefined || pnpmDir === undefined) {
    process.stderr.write(
      'Usage: node scripts/check-deployed-lock.mjs <pnpm-lock.yaml> <node_modules/.pnpm>\n',
    );
    process.exit(2);
  }
  const result = checkDeployedLock(readFileSync(lockPath, 'utf8'), readdirSync(pnpmDir));
  if (result.checked === 0) {
    process.stderr.write(`check-deployed-lock: no packages found in ${pnpmDir}.\n`);
    process.exit(1);
  }
  if (!result.ok) {
    process.stderr.write(
      'check-deployed-lock: pnpm deploy installed versions that pnpm-lock.yaml does not name:\n' +
        `  ${result.unlocked.join('\n  ')}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `check-deployed-lock: all ${result.checked} deployed packages match pnpm-lock.yaml.\n`,
  );
}
