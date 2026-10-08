import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { bootstrapRoles } from '@quad/db/admin';

import { requireEnv, runCommand } from './run-command';

import type { AdminConnection, RoleCredentials } from '@quad/db/admin';

/** The Amazon RDS CA bundle the api image ships (`/app/certs`, beside `/app/dist`). */
const RDS_CA_BUNDLE = resolve(__dirname, '../certs/rds-global-bundle.pem');

const ADMIN_PARTS = [
  'DATABASE_ADMIN_HOST',
  'DATABASE_ADMIN_PORT',
  'DATABASE_ADMIN_USER',
  'DATABASE_ADMIN_PASSWORD',
] as const;

const PORT_PATTERN = /^\d{1,5}$/;

/**
 * The RDS master user's connection (ruling R-db-admin, D28). `DATABASE_ADMIN_URL` wins when set
 * (local runs and CI). Otherwise all four `DATABASE_ADMIN_*` parts are required (on AWS, the user
 * and password come from the RDS-managed secret) and become a client config object, never a URL,
 * with TLS verified against the RDS CA bundle. Errors name variables, never values.
 */
export function adminConnectionFromEnv(
  env: NodeJS.ProcessEnv,
  readCa: () => string = () => readFileSync(RDS_CA_BUNDLE, 'utf8'),
): AdminConnection {
  const url = env.DATABASE_ADMIN_URL;
  if (url !== undefined && url !== '') {
    return url;
  }
  const missing = ADMIN_PARTS.filter((key) => env[key] === undefined || env[key] === '');
  if (missing.length > 0) {
    throw new Error(
      `DATABASE_ADMIN_URL, or all of ${ADMIN_PARTS.join(', ')}, is required; missing: ${missing.join(', ')}.`,
    );
  }
  const portText = requireEnv(env, 'DATABASE_ADMIN_PORT');
  const port = Number(portText);
  if (!PORT_PATTERN.test(portText) || port < 1 || port > 65_535) {
    throw new Error('DATABASE_ADMIN_PORT must be a whole number from 1 to 65535.');
  }
  return {
    host: requireEnv(env, 'DATABASE_ADMIN_HOST'),
    port,
    user: requireEnv(env, 'DATABASE_ADMIN_USER'),
    password: requireEnv(env, 'DATABASE_ADMIN_PASSWORD'),
    ssl: { rejectUnauthorized: true, ca: readCa() },
  };
}

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
 * `node dist/db-bootstrap.js`: as the RDS master user (`adminConnectionFromEnv`), creates or
 * updates the owner, app and platform roles named by the user and password in
 * `DATABASE_OWNER_URL`, `DATABASE_URL` and `DATABASE_PLATFORM_URL`. Runs before `migrate`.
 */
async function dbBootstrap(): Promise<string> {
  const env = process.env;
  const admin = adminConnectionFromEnv(env);
  const ownerUrl = requireEnv(env, 'DATABASE_OWNER_URL');
  const database = databaseFromUrl(ownerUrl);
  await bootstrapRoles(
    admin,
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
