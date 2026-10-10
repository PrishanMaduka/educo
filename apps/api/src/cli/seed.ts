import { seedDatabase, seedPasswordRefusal, seedSecrets } from '@quad/db/admin';

import { requireEnv, runCommand } from './run-command';

import type { SeedEnvironment } from '@quad/db/admin';

const SEEDABLE_ENVIRONMENTS: readonly SeedEnvironment[] = ['local', 'staging'];

const seedEnvironmentOf = (appEnv: string | undefined): SeedEnvironment | undefined =>
  SEEDABLE_ENVIRONMENTS.find((environment) => environment === appEnv);

const NOT_SEEDABLE =
  'Seed data is sample schools only; it only runs when APP_ENV is local or staging.';

/**
 * Why seeding must not run with `env`, or null when it may: APP_ENV is an allow-list (D28), and
 * outside local SEED_PASSWORD must be set and not the published placeholder (D32).
 */
export function seedRefusal(env: Readonly<Record<string, string | undefined>>): string | null {
  if (seedEnvironmentOf(env.APP_ENV) === undefined) {
    return NOT_SEEDABLE;
  }
  return seedPasswordRefusal(env);
}

/**
 * `node dist/seed.js`: upserts the sample schools, console users and people as the owner role
 * (`DATABASE_OWNER_URL`). On local it seals their authenticator secrets with
 * `FIELD_ENCRYPTION_KEY`; on staging it leaves them without one, to set up at first sign-in (D55).
 */
async function seed(): Promise<string> {
  const refusal = seedRefusal(process.env);
  const environment = seedEnvironmentOf(process.env.APP_ENV);
  if (refusal !== null || environment === undefined) {
    throw new Error(refusal ?? NOT_SEEDABLE);
  }
  const ownerUrl = requireEnv(process.env, 'DATABASE_OWNER_URL');
  requireEnv(process.env, 'FIELD_ENCRYPTION_KEY');
  await seedDatabase(ownerUrl, seedSecrets(process.env), environment);
  return 'Seed data is in place.';
}

if (require.main === module) {
  runCommand('seed', seed);
}
