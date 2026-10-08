import { resolve } from 'node:path';

import { runMigrations } from '@quad/db/admin';

import { requireEnv, runCommand } from './run-command';

/**
 * `node dist/migrate.js`: applies the migrations shipped in `dist/migrations` as the owner role
 * (`DATABASE_OWNER_URL`). The deploy runs it as a one-off task before the new API starts.
 */
async function migrate(): Promise<string> {
  await runMigrations(
    requireEnv(process.env, 'DATABASE_OWNER_URL'),
    resolve(__dirname, 'migrations'),
  );
  return 'Migrations applied.';
}

if (require.main === module) {
  runCommand('migrate', migrate);
}
