import { generateSecret } from 'otplib';
import { describe, expect, it } from 'vitest';

import { TotpCodes } from '../../src/common/crypto/totp';
import { loadConfig } from '../../src/config';
import { localEnv } from '../env';

import type { Config } from '../../src/config';

const NOW = new Date(Date.UTC(2026, 9, 8, 3, 30, 1));
const local = loadConfig(localEnv({ DEV_FIXED_OTP: '000000' }));

/** The config as staging would hold it if the boot check were ever bypassed (D46). */
function as(appEnv: Config['APP_ENV']): TotpCodes {
  return new TotpCodes({ ...local, APP_ENV: appEnv });
}

describe('TotpCodes.devFixedCode (staff two-step: DEV_FIXED_OTP is local only, D46)', () => {
  it('is the fixed code locally, and staff two-step accepts it', async () => {
    const codes = as('local');
    expect(codes.devFixedCode).toBe('000000');
    await expect(
      codes.match(generateSecret(), '000000', NOW, null, codes.devFixedCode),
    ).resolves.toEqual({ step: null });
  });

  it('is nothing when the variable is unset', () => {
    const unset = loadConfig(localEnv({ DEV_FIXED_OTP: undefined }));
    expect(new TotpCodes(unset).devFixedCode).toBeUndefined();
  });

  it.each(['staging', 'production'] as const)(
    'is nothing in %s, even when the variable is set, so 000000 is refused',
    async (appEnv) => {
      const codes = as(appEnv);
      expect(codes.devFixedCode).toBeUndefined();
      await expect(
        codes.match(generateSecret(), '000000', NOW, null, codes.devFixedCode),
      ).resolves.toBeNull();
    },
  );
});
