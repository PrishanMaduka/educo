import { seedDatabase } from '@quad/db/admin';

import { requireEnv, runCommand } from './run-command';

/** Why seeding must not run in `appEnv`, or null when it may. */
export function seedRefusal(appEnv: string | undefined): string | null {
  return appEnv === 'production'
    ? 'Seed data is sample schools only; it never runs in production.'
    : null;
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
