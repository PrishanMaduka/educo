// Fails the build if an npm package was bundled into dist. Bundled copies are invisible to
// OpenTelemetry's require hooks (pg, ioredis, fastify spans) and drift from the lockfile; only
// the @quad/* workspace packages may be inlined (see tsup.config.ts and D25).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new globalThis.URL('../dist/', import.meta.url));
const maps = readdirSync(dist).filter((name) => name.endsWith('.js.map'));
if (maps.length === 0) {
  process.stderr.write('check-dist: no source maps in dist/; run tsup first.\n');
  process.exit(1);
}

// dist/migrate.js applies the migrations copied next to it (scripts/copy-migrations.mjs).
if (!existsSync(join(dist, 'migrations/meta/_journal.json'))) {
  process.stderr.write(
    'check-dist: dist/migrations/meta/_journal.json is missing; run scripts/copy-migrations.mjs.\n',
  );
  process.exit(1);
}

// tsup's own `import.meta.url` shim is build tooling, not a runtime package.
const ALLOWED = new Set(['tsup']);

const problems = [];
for (const name of maps) {
  const { sources } = JSON.parse(readFileSync(join(dist, name), 'utf8'));
  const bundled = new Set(
    sources
      .map((source) => /node_modules\/\.pnpm\/((?:@[^/]+\/)?[^/@]+)@/.exec(source)?.[1])
      .filter((pkg) => pkg !== undefined && !ALLOWED.has(pkg)),
  );
  if (bundled.size > 0) {
    problems.push(`${name.replace(/\.map$/, '')}: ${[...bundled].sort().join(', ')}`);
  }
}

if (problems.length > 0) {
  process.stderr.write(
    'check-dist: npm packages were bundled into dist. Add them to apps/api dependencies so ' +
      `tsup keeps them external:\n  ${problems.join('\n  ')}\n`,
  );
  process.exit(1);
}
process.stdout.write(
  `check-dist: ${maps.length} bundles contain no npm package sources; migrations are in dist.\n`,
);
