import { describe, expect, it } from 'vitest';

import { SchoolHealthLevel, TenantRegion, TenantStatus } from './index';

describe('tenant enums (spec 04, Platform)', () => {
  it('lists the regions in spec order', () => {
    expect(TenantRegion.options).toEqual(['ap-south', 'me-central', 'ap-southeast']);
  });

  it('lists the school statuses in spec order', () => {
    expect(TenantStatus.options).toEqual([
      'trial',
      'onboarding',
      'active',
      'past_due',
      'suspended',
      'deleted',
    ]);
  });

  it('lists the health levels in spec order and rejects others', () => {
    expect(SchoolHealthLevel.options).toEqual(['thriving', 'watch', 'at_risk', 'paused']);
    expect(SchoolHealthLevel.safeParse('great').success).toBe(false);
  });
});
