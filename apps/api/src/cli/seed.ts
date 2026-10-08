import { seedDatabase, seedPasswordRefusal } from '@quad/db/admin';

import { requireEnv, runCommand } from './run-command';

const SEEDABLE_ENVIRONMENTS: ReadonlySet<string> = new Set(['local', 'staging']);

/**
 * Why seeding must not run with `env`, or null when it may: APP_ENV is an allow-list (D28), and
 * outside local SEED_PASSWORD must be set and not the published placeholder (D32).
 */
export function seedRefusal(env: Readonly<Record<string, string | undefined>>): string | null {
  const appEnv = env.APP_ENV;
  if (appEnv === undefined || !SEEDABLE_ENVIRONMENTS.has(appEnv)) {
    return 'Seed data is sample schools only; it only runs when APP_ENV is local or staging.';
  }
  return seedPasswordRefusal(env);
}

/** `node dist/seed.js`: upserts the sample schools as the owner role (`DATABASE_OWNER_URL`). */
async function seed(): Promise<string> {
  const refusal = seedRefusal(process.env);
  if (refusal !== null) {
    throw new Error(refusal);
  }
  await seedDatabase(requireEnv(process.env, 'DATABASE_OWNER_URL'));
  return 'Seed data is in place.';
}

if (require.main === module) {
  runCommand('seed', seed);
}
