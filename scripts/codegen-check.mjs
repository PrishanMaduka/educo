#!/usr/bin/env node
// Regenerates everything, then fails if a generated file changed or is untracked.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { runTool } from './flutter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** @type {(cmd: string, args: string[]) => unknown} */
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });
/** @type {(args: string[]) => string} */
const out = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const GENERATED = [
  'packages/contracts/openapi.json',
  'packages/client/src/generated',
  'apps/parent/packages/quad_api',
  'packages/tokens/dist',
  'apps/parent/lib/theme/tokens.g.dart',
  'apps/parent/lib/l10n/*.arb',
  // riverpod_generator parts (git pathspec * also matches subfolders).
  'apps/parent/lib/*.g.dart',
];

run('pnpm', ['api:client']);
if (existsSync(resolve(root, 'packages/tokens/package.json'))) run('pnpm', ['tokens:build']);
run('pnpm', ['i18n:build']);
const parentApp = resolve(root, 'apps/parent');
runTool('flutter', ['pub', 'get'], parentApp);
runTool('dart', ['run', 'build_runner', 'build'], parentApp);

// Porcelain status covers staged, unstaged, deleted and untracked files.
const stale = out(['status', '--porcelain', '--untracked-files=all', '--', ...GENERATED])
  .split('\n')
  .filter(Boolean);

if (stale.length > 0) {
  process.stderr.write(
    `Generated files are out of date:\n${stale.map((f) => `  ${f}`).join('\n')}\n`,
  );
  process.stderr.write('Run pnpm api:client / tokens:build / i18n:build and commit the result.\n');
  process.exit(1);
}
process.stdout.write('Generated files are up to date.\n');
