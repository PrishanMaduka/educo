import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

const KEY_INFO = 'quad:otp';

/**
 * The keyed hashes `otp_challenges` stores (D32): the table is open to `quad_app`, so nothing in
 * it may be readable without the server key. One key, derived by HKDF-SHA256 from
 * `SESSION_SECRET` (info `quad:otp`), for both: `subject_hash` is HMAC-SHA256 of the normalised
 * phone (E.164) or email, and `code_hash` is HMAC-SHA256 over (challenge id, code), because an
 * unkeyed hash of a 6-digit code would be reversed by trying all million.
 */
export class OtpHashes {
  private readonly key: Buffer;

  constructor(sessionSecret: string) {
    this.key = Buffer.from(hkdfSync('sha256', sessionSecret, '', KEY_INFO, 32));
  }

  subject(normalised: string): Buffer {
    return this.hmac(normalised);
  }

  code(challengeId: string, code: string): Buffer {
    return this.hmac(`${challengeId}.${code}`);
  }

  /** Whether `code` is the challenge's code (constant time). */
  matches(challengeId: string, code: string, codeHash: Buffer): boolean {
    const expected = this.code(challengeId, code);
    return expected.length === codeHash.length && timingSafeEqual(expected, codeHash);
  }

  private hmac(value: string): Buffer {
    return createHmac('sha256', this.key).update(value).digest();
  }
}
