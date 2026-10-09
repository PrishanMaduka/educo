import { resolve } from 'node:path';

import { loadLocalEnvFile } from '@quad/db/env';

import { ConfigError, loadConfig } from './config';

import type { Config } from './config';

/**
 * Loads the repository's root `.env` with `loadLocalEnvFile` (`@quad/db/env`, the one gated
 * loader: local only), validates the configuration, and on a `ConfigError` prints the problems
 * and exits with code 1. `__dirname` is `apps/api/dist` once built (and `apps/api/src` from
 * source), so the root is three levels up.
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
