import { describe, expect, it } from 'vitest';

import { LocalTurnstile } from '../../src/common/turnstile/local-turnstile';

describe('LocalTurnstile (APP_ENV=local with no secret: no network, D57)', () => {
  const verifier = new LocalTurnstile();
  const check = (token: string) =>
    verifier.verify({ token, remoteIp: '127.0.0.1', action: 'demo-request' });

  it("passes Cloudflare's dummy token, which the test site keys produce", async () => {
    await expect(check('XXXX.DUMMY.TOKEN.XXXX')).resolves.toEqual({ outcome: 'pass' });
  });

  it('fails the token "fail", and any other token', async () => {
    await expect(check('fail')).resolves.toEqual({ outcome: 'fail' });
    await expect(check('a-real-looking-token')).resolves.toEqual({ outcome: 'fail' });
  });

  it('is unavailable for the token "unavailable"', async () => {
    await expect(check('unavailable')).resolves.toEqual({ outcome: 'unavailable' });
  });
});
