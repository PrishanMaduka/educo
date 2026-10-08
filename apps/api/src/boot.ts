import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { ConfigError, loadConfig } from './config';

import type { Config } from './config';

/**
 * Copies a `.env` file into `env` for local runs only: when APP_ENV is unset, empty or `local`
 * (checked before reading the file). Staging and production take their configuration from the
 * environment alone, so a stray `.env` in an image cannot switch on local flags. Variables
 * already set win. Returns whether the file was loaded.
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

/**
 * Loads the repository's root `.env` (see `loadLocalEnvFile`), validates the configuration,
 * and on a `ConfigError` prints the problems and exits with code 1. `__dirname` is
 * `apps/api/dist` once built (and `apps/api/src` from source), so the root is three levels up.
 */
export function loadBootConfig(): Config {
  loadLocalEnvFile(process.env, resolve(__dirname, '../../../.env'));
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}
