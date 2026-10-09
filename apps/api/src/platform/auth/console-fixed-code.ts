import type { Config } from '../../config';

/**
 * The fixed authenticator code the console accepts: `DEV_FIXED_OTP`, and only with
 * `APP_ENV=local` (Task 10 fix round 1, D32). Staging needs a real authenticator for the console,
 * even though staff two-step there still takes the fixed code; production refuses the variable at
 * boot.
 */
export function consoleFixedCode(config: Config): string | undefined {
  return config.APP_ENV === 'local' ? config.DEV_FIXED_OTP : undefined;
}
