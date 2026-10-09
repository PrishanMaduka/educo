import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { SignedLinks } from '../../src/common/crypto/signed-links';
import { AppError, InvalidLinkError } from '../../src/common/errors';
import { localEnv } from '../env';

import type { SignedTokenUse } from '../../src/common/crypto/signed-links';
import type { SignedLinkPurpose } from '@quad/contracts';

const env = localEnv();
const LINK_SECRET = env.LINK_SIGNING_SECRET ?? '';
const SESSION_SECRET = env.SESSION_SECRET ?? '';
const TENANT = '0192f0c4-7a3b-7c2d-8e9f-0a1b2c3d4e5f';
const SUBJECT = '0192f0c4-7a3b-7c2d-8e9f-0a1b2c3d4e60';
const NOW = new Date('2026-10-08T09:00:00Z');
const MINUTE_MS = 60_000;

/** A stand-in for `consume_signed_token`: true only the first time a nonce is seen. */
function fakeConsume() {
  const seen = new Set<string>();
  return vi.fn((use: SignedTokenUse) => {
    const firstUse = !seen.has(use.nonce);
    seen.add(use.nonce);
    return Promise.resolve(firstUse);
  });
}

function links(consume = fakeConsume(), secret = LINK_SECRET) {
  return { consume, links: new SignedLinks(secret, consume) };
}

/** Signs any JSON with the link secret, the way an insider with the key could. */
function forge(payload: unknown, secret = LINK_SECRET): string {
  const segment = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', secret).update(segment).digest('base64url');
  return `${segment}.${mac}`;
}

async function refusal(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected the link to be refused.');
    },
    (error: unknown) => error,
  );
}

async function expectInvalidLink(promise: Promise<unknown>): Promise<void> {
  const error = await refusal(promise);
  expect(error).toBeInstanceOf(InvalidLinkError);
  expect(error).toMatchObject({ code: 'invalid_link', status: 400 });
}

describe('SignedLinks', () => {
  it('round-trips: a fresh link verifies and returns its payload', async () => {
    const { links: signer } = links();
    const token = signer.signLink({ purpose: 'staff_invite', tid: TENANT, sub: SUBJECT }, NOW);
    const payload = await signer.verifyLink(token, 'staff_invite', NOW);
    expect(payload).toMatchObject({ purpose: 'staff_invite', tid: TENANT, sub: SUBJECT });
    expect(payload.exp).toBe(NOW.getTime() / 1000 + 7 * 24 * 60 * 60);
  });

  it('builds base64url(payload).base64url(HMAC-SHA256) with a 128-bit nonce (spec 05)', () => {
    const { links: signer } = links();
    const token = signer.signLink({ purpose: 'password_reset', tid: null, sub: SUBJECT }, NOW);
    const [segment, mac, extra] = token.split('.');
    expect(extra).toBeUndefined();
    expect(mac).toBe(
      createHmac('sha256', LINK_SECRET)
        .update(segment ?? '')
        .digest('base64url'),
    );
    const payload = JSON.parse(Buffer.from(segment ?? '', 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    const { nonce, ...rest } = payload;
    expect(rest).toEqual({
      purpose: 'password_reset',
      tid: null,
      sub: SUBJECT,
      exp: NOW.getTime() / 1000 + 30 * 60,
    });
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(String(nonce), 'base64url')).toHaveLength(16);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it('uses a new nonce for every link', () => {
    const { links: signer } = links();
    const input = { purpose: 'email_link', tid: TENANT, sub: SUBJECT } as const;
    expect(signer.signLink(input, NOW)).not.toBe(signer.signLink(input, NOW));
  });

  it('refuses to sign a school-less link for any purpose but password_reset (OQ8)', () => {
    const { links: signer } = links();
    expect(() =>
      signer.signLink({ purpose: 'staff_invite', tid: null, sub: SUBJECT }, NOW),
    ).toThrow(/school/);
  });

  it('gives invalid_link when one payload character is flipped', async () => {
    const { links: signer, consume } = links();
    const token = signer.signLink({ purpose: 'staff_invite', tid: TENANT, sub: SUBJECT }, NOW);
    for (const index of [0, 10, token.indexOf('.') - 1]) {
      const flipped = token[index] === 'A' ? 'B' : 'A';
      const tampered = token.slice(0, index) + flipped + token.slice(index + 1);
      await expectInvalidLink(signer.verifyLink(tampered, 'staff_invite', NOW));
    }
    expect(consume).not.toHaveBeenCalled();
  });

  it('gives invalid_link for a signature re-encoded with different unused trailing bits', async () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const { links: signer } = links();
    const token = signer.signLink({ purpose: 'email_link', tid: TENANT, sub: SUBJECT }, NOW);
    const last = alphabet.indexOf(token.at(-1) ?? 'A');
    // 32 bytes take 43 characters; the last one carries 4 bits and 2 unused bits.
    const reencoded = token.slice(0, -1) + (alphabet[last ^ 1] ?? 'A');
    expect(Buffer.from(reencoded.split('.')[1] ?? '', 'base64url')).toEqual(
      Buffer.from(token.split('.')[1] ?? '', 'base64url'),
    );
    await expectInvalidLink(signer.verifyLink(reencoded, 'email_link', NOW));
  });

  it('gives invalid_link for a token signed with SESSION_SECRET', async () => {
    const { links: otherKey } = links(fakeConsume(), SESSION_SECRET);
    const { links: verifier, consume } = links();
    const token = otherKey.signLink({ purpose: 'staff_invite', tid: TENANT, sub: SUBJECT }, NOW);
    await expectInvalidLink(verifier.verifyLink(token, 'staff_invite', NOW));
    expect(consume).not.toHaveBeenCalled();
  });

  it('gives invalid_link for a reused single-use nonce', async () => {
    const { links: signer, consume } = links();
    const token = signer.signLink({ purpose: 'password_reset', tid: null, sub: SUBJECT }, NOW);
    await expect(signer.verifyLink(token, 'password_reset', NOW)).resolves.toBeDefined();
    await expectInvalidLink(signer.verifyLink(token, 'password_reset', NOW));
    expect(consume).toHaveBeenCalledTimes(2);
  });

  it('records the nonce with its purpose and expiry', async () => {
    const { links: signer, consume } = links();
    const token = signer.signLink({ purpose: 'support_session', tid: TENANT, sub: SUBJECT }, NOW);
    const payload = await signer.verifyLink(token, 'support_session', NOW);
    expect(consume).toHaveBeenCalledWith({
      nonce: payload.nonce,
      purpose: 'support_session',
      expiresAt: new Date(NOW.getTime() + 2 * MINUTE_MS),
    });
  });

  it.each<SignedLinkPurpose>(['calendar_feed', 'email_link'])(
    'lets a reusable %s link verify again without recording its nonce',
    async (purpose) => {
      const { links: signer, consume } = links();
      const token = signer.signLink({ purpose, tid: TENANT, sub: SUBJECT }, NOW);
      await signer.verifyLink(token, purpose, NOW);
      await signer.verifyLink(token, purpose, NOW);
      expect(consume).not.toHaveBeenCalled();
    },
  );

  it('gives invalid_link for the wrong purpose, without recording the nonce', async () => {
    const { links: signer, consume } = links();
    const token = signer.signLink({ purpose: 'staff_invite', tid: TENANT, sub: SUBJECT }, NOW);
    await expectInvalidLink(signer.verifyLink(token, 'guardian_invite', NOW));
    expect(consume).not.toHaveBeenCalled();
  });

  it('gives invalid_link at the expiry instant, and verifies a millisecond before', async () => {
    const { links: signer } = links();
    const token = signer.signLink({ purpose: 'password_reset', tid: null, sub: SUBJECT }, NOW);
    const expiry = NOW.getTime() + 30 * MINUTE_MS;
    await expectInvalidLink(signer.verifyLink(token, 'password_reset', new Date(expiry)));
    await expect(
      signer.verifyLink(token, 'password_reset', new Date(expiry - 1)),
    ).resolves.toMatchObject({ purpose: 'password_reset' });
  });

  it.each<[string, unknown]>([
    ['a payload that is not JSON', 'not json'],
    [
      'a payload with an extra key',
      {
        purpose: 'email_link',
        tid: TENANT,
        sub: SUBJECT,
        exp: 1_900_000_000,
        nonce: 'AAAAAAAAAAAAAAAAAAAAAA',
        role: 'admin',
      },
    ],
    [
      'a payload with no nonce',
      { purpose: 'email_link', tid: TENANT, sub: SUBJECT, exp: 1_900_000_000 },
    ],
    [
      'a school-less invite',
      {
        purpose: 'staff_invite',
        tid: null,
        sub: SUBJECT,
        exp: 1_900_000_000,
        nonce: 'AAAAAAAAAAAAAAAAAAAAAA',
      },
    ],
  ])(
    'gives invalid_link for a correctly signed but malformed token: %s',
    async (_name, payload) => {
      const { links: signer, consume } = links();
      const segment =
        typeof payload === 'string' ? Buffer.from(payload).toString('base64url') : undefined;
      const token =
        segment === undefined
          ? forge(payload)
          : `${segment}.${createHmac('sha256', LINK_SECRET).update(segment).digest('base64url')}`;
      const purpose =
        typeof payload === 'object' &&
        payload !== null &&
        'purpose' in payload &&
        payload.purpose === 'staff_invite'
          ? 'staff_invite'
          : 'email_link';
      await expectInvalidLink(signer.verifyLink(token, purpose, NOW));
      expect(consume).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['an empty token', ''],
    ['no signature', 'eyJhIjoxfQ'],
    ['three parts', 'a.b.c'],
    ['a short signature', 'eyJhIjoxfQ.AAAA'],
    ['characters outside base64url', 'eyJhIjoxfQ.AAAA+AAA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
  ])('gives invalid_link for %s', async (_name, token) => {
    const { links: signer } = links();
    await expectInvalidLink(signer.verifyLink(token, 'email_link', NOW));
  });

  it('says the same thing for every refusal and never names the school', async () => {
    const { links: signer } = links();
    const token = signer.signLink({ purpose: 'staff_invite', tid: TENANT, sub: SUBJECT }, NOW);
    const expired = await refusal(
      signer.verifyLink(token, 'staff_invite', new Date(NOW.getTime() + 8 * 24 * 60 * MINUTE_MS)),
    );
    const wrongPurpose = await refusal(signer.verifyLink(token, 'email_link', NOW));
    const tampered = await refusal(signer.verifyLink(`${token}A`, 'staff_invite', NOW));
    const messages = [expired, wrongPurpose, tampered].map((e) =>
      e instanceof AppError ? e.message : 'not an AppError',
    );
    expect(new Set(messages).size).toBe(1);
    expect(messages[0]).not.toContain(TENANT);
    expect(messages[0]).not.toMatch(/school/i);
  });

  it('lets a failure to record the nonce surface as an error, not as a valid link', async () => {
    const consume = vi.fn(() => Promise.reject(new Error('database unavailable')));
    const { links: signer } = links(consume);
    const token = signer.signLink({ purpose: 'staff_invite', tid: TENANT, sub: SUBJECT }, NOW);
    await expect(signer.verifyLink(token, 'staff_invite', NOW)).rejects.toThrow(
      'database unavailable',
    );
  });
});

describe('SignedLinks.inspectLink (does not use up a single-use link)', () => {
  it('returns the payload of a good link without recording its nonce', () => {
    const { consume, links: signer } = links();
    const token = signer.signLink({ purpose: 'password_reset', tid: null, sub: SUBJECT }, NOW);
    expect(signer.inspectLink(token, 'password_reset', NOW)).toMatchObject({
      purpose: 'password_reset',
      tid: null,
      sub: SUBJECT,
    });
    expect(consume).not.toHaveBeenCalled();
  });

  it('leaves the link usable: verifyLink still accepts it once afterwards', async () => {
    const { links: signer } = links();
    const token = signer.signLink({ purpose: 'password_reset', tid: null, sub: SUBJECT }, NOW);
    signer.inspectLink(token, 'password_reset', NOW);
    signer.inspectLink(token, 'password_reset', NOW);
    await expect(signer.verifyLink(token, 'password_reset', NOW)).resolves.toMatchObject({
      sub: SUBJECT,
    });
    await expectInvalidLink(signer.verifyLink(token, 'password_reset', NOW));
  });

  it('refuses a changed, wrongly signed, wrong-purpose or expired link with invalid_link', () => {
    const { links: signer } = links();
    const token = signer.signLink({ purpose: 'password_reset', tid: null, sub: SUBJECT }, NOW);
    const [segment, mac] = token.split('.');
    const flipped = `${segment?.slice(0, -2) ?? ''}${segment?.endsWith('A') === true ? 'B' : 'A'}${segment?.slice(-1) ?? ''}.${mac ?? ''}`;
    const later = new Date(NOW.getTime() + 30 * MINUTE_MS);
    for (const [candidate, purpose, at] of [
      [flipped, 'password_reset', NOW],
      [forge({ purpose: 'password_reset' }, SESSION_SECRET), 'password_reset', NOW],
      [token, 'staff_invite', NOW],
      [token, 'password_reset', later],
      ['not-a-token', 'password_reset', NOW],
    ] as const) {
      expect(() => signer.inspectLink(candidate, purpose, at)).toThrow(InvalidLinkError);
    }
  });
});
