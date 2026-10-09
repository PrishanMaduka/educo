import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import {
  expiredTestLink,
  signTestLink,
  tamperedTestLink,
} from '@quad/config/playwright/signed-token';
import { describe, expect, it } from 'vitest';

import { SignedLinks } from '../../src/common/crypto/signed-links';
import { InvalidLinkError } from '../../src/common/errors';

/**
 * The Playwright helper that signs links by hand for journey 43 (packages/config, Task 18) makes
 * links this API reads as the journey expects: a good one verifies, and the expired, wrong-purpose
 * and tampered ones are refused as `invalid_link`. Both sides use the stack's local secret from
 * .env.example.
 */

const now = new Date('2026-10-09T12:00:00Z');
const inAMinute = Math.floor(now.getTime() / 1000) + 60;
/** The stack's local secret, as the helper reads it. */
const { LINK_SIGNING_SECRET = '' } = parseEnv(
  readFileSync(new URL('../../../../.env.example', import.meta.url), 'utf8'),
);
const links = () => new SignedLinks(LINK_SIGNING_SECRET, () => Promise.resolve(true));
const reset = { purpose: 'password_reset', tid: null, sub: '0193e6a1-0000-7000-8000-0000000000aa' };

describe('the signed-token helper against SignedLinks', () => {
  it('signs a link the API verifies', async () => {
    const token = signTestLink({ ...reset, exp: inAMinute });
    await expect(links().verifyLink(token, 'password_reset', now)).resolves.toMatchObject({
      sub: reset.sub,
      tid: null,
    });
  });

  it('makes an expired link the API refuses', async () => {
    const token = expiredTestLink(reset, { now });
    await expect(links().verifyLink(token, 'password_reset', now)).rejects.toBeInstanceOf(
      InvalidLinkError,
    );
  });

  it('makes a wrong-purpose link the API refuses', async () => {
    const token = signTestLink({ ...reset, exp: inAMinute });
    await expect(links().verifyLink(token, 'staff_invite', now)).rejects.toBeInstanceOf(
      InvalidLinkError,
    );
  });

  it('makes a tampered link the API refuses', async () => {
    const token = tamperedTestLink({ ...reset, exp: inAMinute });
    await expect(links().verifyLink(token, 'password_reset', now)).rejects.toBeInstanceOf(
      InvalidLinkError,
    );
  });
});
