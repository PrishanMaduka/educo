import { seedDatabase } from '@quad/db/admin';

import { requireEnv, runCommand } from './run-command';

const SEEDABLE_ENVIRONMENTS: ReadonlySet<string> = new Set(['local', 'staging']);

/** Why seeding must not run in `appEnv`, or null when it may (an allow-list, D28). */
export function seedRefusal(appEnv: string | undefined): string | null {
  return appEnv !== undefined && SEEDABLE_ENVIRONMENTS.has(appEnv)
    ? null
    : 'Seed data is sample schools only; it only runs when APP_ENV is local or staging.';
}

/** `node dist/seed.js`: upserts the sample schools as the owner role (`DATABASE_OWNER_URL`). */
async function seed(): Promise<string> {
  const refusal = seedRefusal(process.env.APP_ENV);
  if (refusal !== null) {
    throw new Error(refusal);
  }
  await seedDatabase(requireEnv(process.env, 'DATABASE_OWNER_URL'));
  return 'Seed data is in place.';
}

if (require.main === module) {
  runCommand('seed', seed);
}
