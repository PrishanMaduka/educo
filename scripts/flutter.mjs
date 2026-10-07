#!/usr/bin/env node
// Runs `flutter` or `dart` through FVM when it is installed, otherwise from PATH (ruling R7).
//   node scripts/flutter.mjs <flutter|dart> [args...]
// With neither installed it prints a skip message and exits 0, except in CI, where it fails.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const onPath = (name) => {
  const exts = process.platform === 'win32' ? ['.exe', '.bat', '.cmd', ''] : [''];
  return (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => exts.some((ext) => existsSync(join(dir, name + ext))));
};

/** The command and leading arguments for `tool` ('flutter' or 'dart'), or null without a toolchain. */
export function resolveTool(tool) {
  if (onPath('fvm')) return { cmd: 'fvm', args: [tool] };
  if (onPath(tool)) return { cmd: tool, args: [] };
  return null;
}

/** Runs `tool` with `args` in `cwd`; throws when the toolchain is missing or the command fails. */
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
    if (process.env.CI) {
      process.stderr.write(
        `Neither fvm nor ${tool} is on PATH; CI must install Flutter (.fvmrc).\n`,
      );
      process.exit(1);
    }
    process.stdout.write(
      `Skipping "${tool} ${args.join(' ')}": neither fvm nor ${tool} is on PATH. Install Flutter (.fvmrc) to run it.\n`,
    );
    process.exit(0);
  }
  const result = spawnSync(resolved.cmd, [...resolved.args, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  process.exit(result.status ?? 1);
}
