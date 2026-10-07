import { bootstrapRoles } from '@quad/db/admin';

import { requireEnv, runCommand } from './run-command';

import type { RoleCredentials } from '@quad/db/admin';

/** The URL-decoded user and password of a Postgres URL. Errors never include the URL. */
export function parseRoleFromUrl(url: string): RoleCredentials {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('A database URL is not a valid URL.');
  }
  const name = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  if (name === '' || password === '') {
    throw new Error('A database URL needs a user and a password.');
  }
  return { name, password };
}

/** The database name in the URL's path. */
function databaseFromUrl(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (name === '') {
    throw new Error('DATABASE_OWNER_URL needs a database name.');
  }
  return name;
}

/**
 * `node dist/db-bootstrap.js`: as the RDS master user (`DATABASE_ADMIN_URL`), creates or
 * updates the owner, app and platform roles named by the user and password in
 * `DATABASE_OWNER_URL`, `DATABASE_URL` and `DATABASE_PLATFORM_URL`. Runs before `migrate`.
 */
async function dbBootstrap(): Promise<string> {
  const env = process.env;
  const ownerUrl = requireEnv(env, 'DATABASE_OWNER_URL');
  const database = databaseFromUrl(ownerUrl);
  await bootstrapRoles(
    requireEnv(env, 'DATABASE_ADMIN_URL'),
    {
      owner: parseRoleFromUrl(ownerUrl),
      app: parseRoleFromUrl(requireEnv(env, 'DATABASE_URL')),
      platform: parseRoleFromUrl(requireEnv(env, 'DATABASE_PLATFORM_URL')),
    },
    database,
  );
  return `Database roles are in place for ${database}.`;
}

if (require.main === module) {
  runCommand('db-bootstrap', dbBootstrap);
}
