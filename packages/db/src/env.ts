import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
  const appEnv = env.APP_ENV === undefined || env.APP_ENV === '' ? 'local' : env.APP_ENV;
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

/** Loads the repository's root `.env` into `process.env` if it exists; set variables win. */
export function loadRootEnv(): void {
  const path = fileURLToPath(new URL('../../../.env', import.meta.url));
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
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
