#!/usr/bin/env node
// Runs `flutter` or `dart` through FVM when it is installed, otherwise from PATH (ruling R7).
//   node scripts/flutter.mjs <flutter|dart> [args...]
// With neither installed it skips (exit 0, loudly) only on a developer machine: in CI, or with
// QUAD_REQUIRE_FLUTTER=1, it fails.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** @type {(name: string) => boolean} */
const onPath = (name) => {
  const exts = process.platform === 'win32' ? ['.exe', '.bat', '.cmd', ''] : [''];
  return (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => exts.some((ext) => existsSync(join(dir, name + ext))));
};

/**
 * The command and leading arguments for `tool` ('flutter' or 'dart'), or null without a toolchain.
 * @param {'flutter' | 'dart'} tool
 * @returns {{ cmd: string, args: string[] } | null}
 */
export function resolveTool(tool) {
  if (onPath('fvm')) return { cmd: 'fvm', args: [tool] };
  if (onPath(tool)) return { cmd: tool, args: [] };
  return null;
}

/**
 * What to do when Flutter is missing: 'fail' in CI or with QUAD_REQUIRE_FLUTTER=1, else 'skip'.
 * @param {Record<string, string | undefined>} env
 * @returns {'fail' | 'skip'}
 */
export function missingToolchainAction(env) {
  const ci = env.CI ?? '';
  const inCi = ci !== '' && ci !== 'false' && ci !== '0';
  return inCi || env.QUAD_REQUIRE_FLUTTER === '1' ? 'fail' : 'skip';
}

/**
 * Runs `tool` with `args` in `cwd`; throws when the toolchain is missing or the command fails.
 * @param {'flutter' | 'dart'} tool
 * @param {string[]} args
 * @param {string} cwd
 */
export function runTool(tool, args, cwd) {
  const resolved = resolveTool(tool);
  if (!resolved) throw new Error(`${tool} is not installed (neither fvm nor ${tool} is on PATH).`);
  const result = spawnSync(resolved.cmd, [...resolved.args, ...args], {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`${tool} ${args.join(' ')} failed with exit code ${result.status ?? 'null'}.`);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const [tool, ...args] = process.argv.slice(2);
  if (tool !== 'flutter' && tool !== 'dart') {
    process.stderr.write('Usage: node scripts/flutter.mjs <flutter|dart> [args...]\n');
    process.exit(2);
  }
  const resolved = resolveTool(tool);
  if (!resolved) {
    if (missingToolchainAction(process.env) === 'fail') {
      process.stderr.write(
        `Neither fvm nor ${tool} is on PATH. Install Flutter (version in .fvmrc); CI and QUAD_REQUIRE_FLUTTER=1 need it.\n`,
      );
      process.exit(1);
    }
    process.stdout.write(
      `\n*** Flutter checks SKIPPED (no Flutter on PATH): "${tool} ${args.join(' ')}" did not run. Install Flutter (.fvmrc) to run them. ***\n\n`,
    );
    process.exit(0);
  }
  const result = spawnSync(resolved.cmd, [...resolved.args, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  process.exit(result.status ?? 1);
}
