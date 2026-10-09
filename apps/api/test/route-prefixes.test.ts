import { describe, expect, it } from 'vitest';

import { API_PREFIX } from '../src/common/api-prefix';
import { isPlatformPath } from '../src/common/guards/platform-controller.decorator';
import { isNoStoreRoute } from '../src/common/no-store';
import { API_PREFIX as REGISTRY_PREFIX } from '../src/openapi/registry';

describe('route prefixes come from API_PREFIX (fix round 2)', () => {
  it('is one constant, shared with the OpenAPI registry', () => {
    expect(API_PREFIX).toBe('/api/v1');
    expect(REGISTRY_PREFIX).toBe(API_PREFIX);
  });

  it.each([
    ['/api/v1/platform/me', true],
    ['/api/v1/platform', true],
    ['/api/v1/platformx', false],
    ['/api/v2/platform/me', false],
    ['/api/v1/me', false],
  ])('isPlatformPath(%s) is %s', (url, expected) => {
    expect(isPlatformPath(url)).toBe(expected);
  });

  it.each([
    ['/api/v1/auth/password', true],
    ['/api/v1/platform/auth/totp/setup', true],
    ['/api/v1/me/totp', true],
    ['/api/v1/me/totp/', true],
    ['/api/v1/me/totp/recovery', true],
    ['/api/v1/me/totpx', false],
    ['/api/v1/me', false],
    ['/api/v1/platform/me', false],
    // The support visit's single-use link (Task 16).
    ['/api/v1/platform/tenants/:id/support-session', true],
    ['/api/v1/platform/tenants/:id/support-sessionx', false],
    ['/api/v1/platform/tenants', false],
  ])('isNoStoreRoute(%s) is %s', (url, expected) => {
    expect(isNoStoreRoute(url)).toBe(expected);
  });
});
