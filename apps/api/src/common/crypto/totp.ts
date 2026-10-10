import { Inject, Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';

import { CONFIG } from '../../tokens';

import type { Config } from '../../config';

/** One 30-second step either side of now (spec 05: ±1 step). */
const TOTP_TOLERANCE_SECONDS = 30;

/**
 * `DEV_FIXED_OTP`, and only with `APP_ENV=local` (D46): the one rule for every fixed
 * authenticator code (staff two-step and the console). The config refuses the variable outside
 * local at boot; this check holds even if that were bypassed.
 */
export function localFixedCode(
  config: Pick<Config, 'APP_ENV' | 'DEV_FIXED_OTP'>,
): string | undefined {
  return config.APP_ENV === 'local' ? config.DEV_FIXED_OTP : undefined;
}

/** A code that matched: its RFC 6238 time step, or null for the local fixed code. */
export interface TotpMatch {
  readonly step: number | null;
}

/**
 * Authenticator (TOTP) codes for staff two-step (Task 7) and console sign-in (Task 10): new
 * secrets, their otpauth URIs, and checking a code within one step of now and after the last
 * step accepted (RFC 6238 §5.2), so a code is never accepted twice. `DEV_FIXED_OTP` matches only
 * with `APP_ENV=local` (D46), and the config refuses it anywhere else.
 */
@Injectable()
export class TotpCodes {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  /** `DEV_FIXED_OTP`: what staff two-step accepts, with `APP_ENV=local` only (D46). */
  get devFixedCode(): string | undefined {
    return localFixedCode(this.config);
  }

  /** A new base32 secret. */
  newSecret(): string {
    return generateSecret();
  }

  /** The `otpauth://totp/…` URI an authenticator app scans. */
  uri(issuer: string, label: string, secret: string): string {
    return generateURI({ issuer, label, secret });
  }

  /**
   * Whether `code` is the authenticator's code within one step of `now` and after `lastStep`:
   * the step it matched, `{ step: null }` for the fixed code, or null for no match. The caller
   * names the fixed code it accepts, if any (no default, so undefined always means none): staff
   * two-step passes `devFixedCode`, the console `consoleFixedCode`.
   */
  async match(
    secret: string,
    code: string,
    now: Date,
    lastStep: number | null,
    fixedCode: string | undefined,
  ): Promise<TotpMatch | null> {
    if (fixedCode !== undefined && code === fixedCode) return { step: null };
    const result = await verify({
      secret,
      token: code,
      epoch: Math.floor(now.getTime() / 1000),
      epochTolerance: TOTP_TOLERANCE_SECONDS,
      ...(lastStep === null ? {} : { afterTimeStep: lastStep }),
    });
    // A TOTP match carries its RFC 6238 time step (the HOTP shape of the union never does).
    if (!result.valid || !('timeStep' in result)) return null;
    return { step: result.timeStep };
  }
}
