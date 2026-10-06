import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ConfigError, loadConfig } from './config';

import type { Config } from './config';

/**
 * Loads the repository's root `.env` when there is one (variables already set win), validates
 * the configuration, and on a `ConfigError` prints the problems and exits with code 1.
 * `__dirname` is `apps/api/dist` once built (and `apps/api/src` from source), so the root is
 * three levels up either way.
 */
export function loadBootConfig(): Config {
  const envFile = resolve(__dirname, '../../../.env');
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
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
