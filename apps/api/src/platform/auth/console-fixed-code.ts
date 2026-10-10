import { localFixedCode } from '../../common/crypto/totp';

import type { Config } from '../../config';

/**
 * The fixed authenticator code the console accepts: `DEV_FIXED_OTP`, and only with
 * `APP_ENV=local`, the same rule as staff two-step (`localFixedCode`, D46). The config refuses the
 * variable outside local at boot.
 */
export function consoleFixedCode(config: Config): string | undefined {
  return localFixedCode(config);
}
