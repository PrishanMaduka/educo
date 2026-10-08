import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildArb, parseCatalogue } from './build';
import { findUnusedKeys } from './unused';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const source = resolve(repo, 'packages/contracts/i18n/en.json');
const target = resolve(repo, 'apps/parent/lib/l10n/app_en.arb');

/** Keys kept although no source uses them yet. Each needs a reason; a used or removed key fails the build. */
const UNUSED_ON_PURPOSE: Record<string, string> = {
  'students.count':
    'the ICU plural sample in packages/ui i18n.test.ts until the Students pages (M2)',
};

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'e2e', 'test', 'l10n']);

/** Source files under `dir` with one of `extensions`, without tests and generated folders. */
function walk(dir: string, extensions: string[]): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : walk(path, extensions);
    const isSource = extensions.some((ext) => entry.name.endsWith(ext));
    return isSource && !/\.(test|spec)\./.test(entry.name) ? [path] : [];
  });
}

const read = (files: string[]) => files.map((file) => readFileSync(file, 'utf8'));
const apps = readdirSync(resolve(repo, 'apps'));
const web = read([
  ...apps.flatMap((app) => walk(resolve(repo, 'apps', app, 'src'), ['.ts', '.tsx'])),
  ...walk(resolve(repo, 'packages/ui/src'), ['.ts', '.tsx']),
]);
const dart = read(walk(resolve(repo, 'apps/parent/lib'), ['.dart']));

const messages = parseCatalogue(JSON.parse(readFileSync(source, 'utf8')), 'en.json');
const { unused, stale } = findUnusedKeys(Object.keys(messages), { web, dart }, UNUSED_ON_PURPOSE);
if (unused.length > 0 || stale.length > 0) {
  if (unused.length > 0) console.error(`Unused keys in en.json: ${unused.join(', ')}`);
  if (stale.length > 0) {
    console.error(`Remove from UNUSED_ON_PURPOSE (used or not in en.json): ${stale.join(', ')}`);
  }
  process.exit(1);
}

const arb = buildArb(messages);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(arb, null, 2)}\n`);
console.log(`Wrote ${Object.keys(messages).length} strings to ${target}`);
