// Copies packages/db/migrations into dist/migrations (or `<target>/migrations`), so
// `dist/migrate.js` in the api image can apply them without the package source.
import { cpSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(
  new globalThis.URL('../../../packages/db/migrations/', import.meta.url),
);
const dist = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new globalThis.URL('../dist/', import.meta.url));
const target = join(dist, 'migrations');

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
process.stdout.write(`copy-migrations: copied the migrations to ${target}.\n`);
