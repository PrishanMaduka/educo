import { describe, expect, it, vi } from 'vitest';

import { SignedLinks } from '../../src/common/crypto/signed-links';
import { InvalidLinkError } from '../../src/common/errors';

import type * as Domain from '@quad/domain';

// A future rule change: calendar_feed made single use but still without an expiry. The nonce
// table needs an expiry, so verifyLink must fail loudly instead of skipping the single-use check.
vi.mock('@quad/domain', async (importOriginal) => {
  const domain = await importOriginal<typeof Domain>();
  return {
    ...domain,
    SIGNED_LINK_RULES: {
      ...domain.SIGNED_LINK_RULES,
      calendar_feed: { ttlSeconds: null, singleUse: true },
    },
  };
});

const NOW = new Date('2026-10-08T09:00:00Z');

describe('SignedLinks with a single-use purpose that never expires', () => {
  it('refuses to verify it as a server error, never as a valid or reusable link', async () => {
    const consume = vi.fn(() => Promise.resolve(true));
    const links = new SignedLinks('test-link-signing-secret-test-link-secret', consume);
    const token = links.signLink(
      {
        purpose: 'calendar_feed',
        tid: '0192f0c4-7a3b-7c2d-8e9f-0a1b2c3d4e5f',
        sub: '0192f0c4-7a3b-7c2d-8e9f-0a1b2c3d4e60',
      },
      NOW,
    );
    const error = await links.verifyLink(token, 'calendar_feed', NOW).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(InvalidLinkError);
    expect(String(error)).toMatch(/single-use calendar_feed link must expire/);
    expect(consume).not.toHaveBeenCalled();
  });
});
