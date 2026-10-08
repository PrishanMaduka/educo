import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { SignedLinkPayloadSchema } from '@quad/contracts';
import { SIGNED_LINK_RULES, signedLinkExpiry, signedLinkStatus } from '@quad/domain';

import { InvalidLinkError } from '../errors';

import type { SignedLinkPayload, SignedLinkPurpose } from '@quad/contracts';
import type { DefinerCalls } from '@quad/db';

/** What `consume_signed_token` records for a single-use link (D16). */
export type SignedTokenUse = Parameters<DefinerCalls['consumeSignedToken']>[0];
/** True only the first time a nonce is used: `definers.consumeSignedToken` (tests use a fake). */
export type ConsumeSignedToken = DefinerCalls['consumeSignedToken'];

/** What a link is for and about; `signLink` adds the expiry and the nonce. */
export interface SignedLinkInput {
  readonly purpose: SignedLinkPurpose;
  /** The school, or null only for an account-level `password_reset` (OQ8). */
  readonly tid: string | null;
  readonly sub: string;
}

const NONCE_BYTES = 16;
const SEGMENT = /^[A-Za-z0-9_-]+$/;

/**
 * Signed links (spec 05; D16, D32): `base64url(payload).base64url(HMAC-SHA256)` keyed by
 * `LINK_SIGNING_SECRET`. The HMAC covers the payload segment exactly as sent (as JWS does), so no
 * other encoding of the same bytes verifies. The tenant in a link is only used after
 * `verifyLink` returns.
 */
export class SignedLinks {
  constructor(
    private readonly secret: string,
    private readonly consumeSignedToken: ConsumeSignedToken,
  ) {}

  /** Signs a link for `input` at `now`, with the purpose's expiry and a 128-bit nonce. */
  signLink(input: SignedLinkInput, now: Date): string {
    const payload: SignedLinkPayload = {
      purpose: input.purpose,
      tid: input.tid,
      sub: input.sub,
      exp: signedLinkExpiry(input.purpose, now),
      nonce: randomBytes(NONCE_BYTES).toString('base64url'),
    };
    // Never hand out a link that could not verify (a school-less invite, for example).
    if (signedLinkStatus(SignedLinkPayloadSchema.parse(payload), input.purpose, now) !== 'ok') {
      throw new Error(`A ${input.purpose} link needs a school (only password_reset may omit it).`);
    }
    const segment = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${segment}.${this.mac(segment)}`;
  }

  /**
   * Checks, in order: the signature (constant time), the payload schema, `signedLinkStatus`
   * (purpose, rules, expiry), then records the nonce of a single-use purpose. Any failure throws
   * `InvalidLinkError`; an error from recording the nonce propagates unchanged.
   */
  async verifyLink(
    token: string,
    purpose: SignedLinkPurpose,
    now: Date,
  ): Promise<SignedLinkPayload> {
    const payload = this.verifiedPayload(token);
    if (payload === null || signedLinkStatus(payload, purpose, now) !== 'ok') {
      throw new InvalidLinkError();
    }
    if (SIGNED_LINK_RULES[purpose].singleUse && payload.exp !== null) {
      const firstUse = await this.consumeSignedToken({
        nonce: payload.nonce,
        purpose,
        expiresAt: new Date(payload.exp * 1000),
      });
      if (!firstUse) {
        throw new InvalidLinkError();
      }
    }
    return payload;
  }

  /** The payload of a correctly signed, well-formed token, or null. */
  private verifiedPayload(token: string): SignedLinkPayload | null {
    const parts = token.split('.');
    const [segment, signature] = parts;
    if (
      parts.length !== 2 ||
      segment === undefined ||
      signature === undefined ||
      !SEGMENT.test(segment) ||
      !SEGMENT.test(signature)
    ) {
      return null;
    }
    // Compared as text, so a signature with different unused trailing bits does not verify.
    const given = Buffer.from(signature, 'ascii');
    const expected = Buffer.from(this.mac(segment), 'ascii');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return null;
    }
    let json: unknown;
    try {
      json = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    const parsed = SignedLinkPayloadSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  }

  /** HMAC-SHA256 of the payload segment, base64url. */
  private mac(segment: string): string {
    return createHmac('sha256', this.secret).update(segment, 'ascii').digest('base64url');
  }
}
