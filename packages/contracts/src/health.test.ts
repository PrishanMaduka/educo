import { describe, expect, it } from 'vitest';

import { HealthLive, HealthReady } from './index';

describe('health contracts', () => {
  it('live is only ever ok', () => {
    expect(HealthLive.safeParse({ status: 'ok' }).success).toBe(true);
    expect(HealthLive.safeParse({ status: 'down' }).success).toBe(false);
  });

  it('ready reports each dependency as ok or down', () => {
    expect(HealthReady.safeParse({ status: 'ok', db: 'ok', redis: 'ok' }).success).toBe(true);
    expect(HealthReady.safeParse({ status: 'down', db: 'down', redis: 'ok' }).success).toBe(true);
  });

  it('ready rejects an unknown state at the right path', () => {
    const result = HealthReady.safeParse({ status: 'ok', db: 'maybe', redis: 'ok' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['db']);
  });
});
