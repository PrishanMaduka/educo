#!/usr/bin/env node
// Regenerates everything, then fails if a generated file changed or is untracked.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });
const out = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const GENERATED = [
  'packages/contracts/openapi.json',
  'packages/client/src/generated',
  'apps/parent/packages/quad_api',
  'packages/tokens/dist',
  'apps/parent/lib/theme/tokens.g.dart',
  'apps/parent/lib/l10n',
];

run('pnpm', ['api:client']);
if (existsSync(resolve(root, 'packages/tokens/package.json'))) run('pnpm', ['tokens:build']);
run('pnpm', ['i18n:build']);

const changed = out(['diff', '--name-only', '--', ...GENERATED]).split('\n');
const untracked = out(['ls-files', '--others', '--exclude-standard', '--', ...GENERATED]).split(
  '\n',
);
const stale = [...changed, ...untracked].filter(Boolean);

if (stale.length > 0) {
  process.stderr.write(
    `Generated files are out of date:\n${stale.map((f) => `  ${f}`).join('\n')}\n`,
  );
  process.stderr.write('Run pnpm api:client / tokens:build / i18n:build and commit the result.\n');
  process.exit(1);
}
process.stdout.write('Generated files are up to date.\n');
