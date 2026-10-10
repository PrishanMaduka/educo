import { describe, expect, it } from 'vitest';

import {
  CLOUDFLARE_TEST_SECRETS,
  CLOUDFLARE_TEST_SITE_KEYS,
  TURNSTILE_DUMMY_TOKEN,
  TurnstileAction,
  isCloudflareTestSecret,
  isCloudflareTestSiteKey,
} from './turnstile';

describe('Cloudflare Turnstile test keys (D57: local only)', () => {
  it("lists Cloudflare's published test secrets and site keys", () => {
    expect(CLOUDFLARE_TEST_SECRETS).toEqual([
      '1x0000000000000000000000000000000AA',
      '2x0000000000000000000000000000000AA',
      '3x0000000000000000000000000000000AA',
    ]);
    expect(CLOUDFLARE_TEST_SITE_KEYS).toEqual([
      '1x00000000000000000000AA',
      '2x00000000000000000000AB',
      '1x00000000000000000000BB',
      '2x00000000000000000000BB',
      '3x00000000000000000000FF',
    ]);
  });

  it('recognises a test secret or site key, ignoring surrounding spaces', () => {
    expect(isCloudflareTestSecret(' 1x0000000000000000000000000000000AA ')).toBe(true);
    expect(isCloudflareTestSecret('0x4AAAAAAAreal-secret-value')).toBe(false);
    expect(isCloudflareTestSiteKey('3x00000000000000000000FF')).toBe(true);
    expect(isCloudflareTestSiteKey('0x4AAAAAAAreal-site-key')).toBe(false);
  });

  it('names the dummy token the test site keys produce, and the demo form action', () => {
    expect(TURNSTILE_DUMMY_TOKEN).toBe('XXXX.DUMMY.TOKEN.XXXX');
    expect(TurnstileAction.options).toEqual(['demo-request']);
  });
});
