import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

import { LOCAL_SEED_PASSWORD } from '@quad/contracts';

/** Connection URLs for the three database roles (spec 02, D17). */
export interface DatabaseUrls {
  /** `quad_app`: all school work, through `withTenant`. */
  readonly appUrl: string;
  /** `quad_platform`: console routes and platform jobs, through `withPlatform`. */
  readonly platformUrl: string;
  /** `quad_owner`: migrations and seed only. */
  readonly ownerUrl: string;
}

/** The local defaults from `.env.example` (compose Postgres). */
export const LOCAL_DATABASE_URLS: DatabaseUrls = Object.freeze({
  appUrl: 'postgres://quad_app:quad_app@localhost:5432/quad',
  platformUrl: 'postgres://quad_platform:quad_platform@localhost:5432/quad',
  ownerUrl: 'postgres://quad_owner:quad_owner@localhost:5432/quad',
});

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Reads the database URLs from the environment. Missing values fall back to the local defaults
 * only when APP_ENV is local or unset, so staging and production never connect somewhere by
 * accident.
 */
export function databaseUrls(env: Env = process.env): DatabaseUrls {
  const appEnv = appEnvOf(env);
  const pick = (key: string, fallback: string): string => {
    const value = env[key];
    if (value !== undefined && value !== '') {
      return value;
    }
    if (appEnv === 'local') {
      return fallback;
    }
    throw new Error(`${key} is required when APP_ENV is ${appEnv}.`);
  };
  return {
    appUrl: pick('DATABASE_URL', LOCAL_DATABASE_URLS.appUrl),
    platformUrl: pick('DATABASE_PLATFORM_URL', LOCAL_DATABASE_URLS.platformUrl),
    ownerUrl: pick('DATABASE_OWNER_URL', LOCAL_DATABASE_URLS.ownerUrl),
  };
}

/** APP_ENV, with unset or empty read as `local` (as `.env.example` sets it). */
function appEnvOf(env: Env): string {
  return env.APP_ENV === undefined || env.APP_ENV === '' ? 'local' : env.APP_ENV;
}

/**
 * Why the seed must not run with this `SEED_PASSWORD`, or null when it may (D32). It must be set
 * everywhere (the seeded people sign in with it), and outside local must not be the published
 * local placeholder. The message never includes the value.
 */
export function seedPasswordRefusal(env: Env = process.env): string | null {
  const appEnv = appEnvOf(env);
  const password = env.SEED_PASSWORD;
  if (password === undefined || password === '') {
    return `SEED_PASSWORD is required when APP_ENV is ${appEnv}.`;
  }
  if (appEnv === 'local') {
    return null;
  }
  return password === LOCAL_SEED_PASSWORD
    ? 'SEED_PASSWORD is the published local value; set a real one.'
    : null;
}

/** What the seed needs from the environment. */
export interface SeedSecrets {
  /** `SEED_PASSWORD`: every seeded staff member and console user signs in with it. */
  readonly password: string;
  /** `FIELD_ENCRYPTION_KEY`, the API's own, so the API can open the seeded TOTP secrets. */
  readonly fieldEncryptionKey: string;
}

/** The seed's secrets from `env`; check `seedPasswordRefusal` first. Missing values are empty. */
export function seedSecrets(env: Env = process.env): SeedSecrets {
  return { password: env.SEED_PASSWORD ?? '', fieldEncryptionKey: env.FIELD_ENCRYPTION_KEY ?? '' };
}

const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Why `pnpm db:seed` must not run, or null when it may (Task 17): only with APP_ENV local (or
 * unset) and a database on this machine, so a developer's shell can never seed staging or
 * production. Staging is seeded only by the api image's own `seed` task (D28).
 */
export function localSeedRefusal(env: Env, ownerUrl: string): string | null {
  const appEnv = appEnvOf(env);
  if (appEnv !== 'local') {
    return `pnpm db:seed is for local databases only (APP_ENV is ${appEnv}).`;
  }
  const host = new URL(ownerUrl).hostname;
  return LOCAL_HOSTS.has(host)
    ? null
    : `pnpm db:seed is for local databases only (the database is on ${host}).`;
}

/**
 * Copies a `.env` file into `env` for local runs only: when APP_ENV is unset, empty or `local`
 * (checked before reading the file). Staging and production take their configuration from the
 * environment alone, so a stray `.env` in an image cannot switch on local flags. Variables
 * already set win. Returns whether the file was loaded. The API (`boot.ts`) and the database
 * scripts (`loadRootEnv`) share this one loader (D27 follow-up, Task 17).
 */
export function loadLocalEnvFile(env: NodeJS.ProcessEnv, path: string): boolean {
  const appEnv = env.APP_ENV;
  if (appEnv !== undefined && appEnv !== '' && appEnv !== 'local') {
    return false;
  }
  if (!existsSync(path)) {
    return false;
  }
  for (const [name, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
    env[name] ??= value;
  }
  return true;
}

/** Loads the repository's root `.env` into `env` with `loadLocalEnvFile` (local only). */
export function loadRootEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return loadLocalEnvFile(env, fileURLToPath(new URL('../../../.env', import.meta.url)));
}

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

/** Returns `url` pointing at database `name` (lowercase identifier only). */
export function withDatabaseName(url: string, name: string): string {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`Unsafe database name: ${JSON.stringify(name)}.`);
  }
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** Whether `name` is a plain lowercase SQL identifier that is safe to interpolate. */
export function isSafeIdentifier(name: string): boolean {
  return SAFE_IDENTIFIER.test(name);
}
