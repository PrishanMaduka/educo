import { Inject, Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';

import { CONFIG } from '../../tokens';

import type { Config } from '../../config';

/** One 30-second step either side of now (spec 05: ±1 step). */
const TOTP_TOLERANCE_SECONDS = 30;

/** A code that matched: its RFC 6238 time step, or null for the local fixed code. */
export interface TotpMatch {
  readonly step: number | null;
}

/**
 * Authenticator (TOTP) codes for staff two-step (Task 7) and console sign-in (Task 10): new
 * secrets, their otpauth URIs, and checking a code within one step of now and after the last
 * step accepted (RFC 6238 §5.2), so a code is never accepted twice. `DEV_FIXED_OTP` matches only
 * when it is set, which the config refuses in production.
 */
@Injectable()
export class TotpCodes {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

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
   * the step it matched, `{ step: null }` for the local fixed code, or null for no match.
   */
  async match(
    secret: string,
    code: string,
    now: Date,
    lastStep: number | null,
  ): Promise<TotpMatch | null> {
    if (this.isFixedCode(code)) return { step: null };
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

  /** Local and staging only: the config refuses `DEV_FIXED_OTP` in production. */
  private isFixedCode(code: string): boolean {
    const fixed = this.config.DEV_FIXED_OTP;
    return fixed !== undefined && code === fixed;
  }
}
