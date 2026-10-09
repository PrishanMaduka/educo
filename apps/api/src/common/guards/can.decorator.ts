import { Reflector } from '@nestjs/core';

import type { PermissionKey } from '@quad/contracts';

/** Read by `CanGuard` (and the route walk, `test/routes-guarded.test.ts`). */
export const CanMarker = Reflector.createDecorator<readonly PermissionKey[]>();

/**
 * Access marker (spec 05, spec 06 Guards): an active session in a school whose effective
 * permissions (`PermissionsService`; a preview's while one is on) hold **any one** of `keys`.
 * `@Can('fees.view', 'finance.view')` lets in someone with either key; for "all of", stack the
 * checks in the service instead. 403 `forbidden` otherwise. Every route carries exactly one of
 * `@Public`, `@PreAuth`, `@Authenticated`, `@Can` and `@PlatformRole` (ruling F02).
 */
export const Can = (
  ...keys: [PermissionKey, ...PermissionKey[]]
): MethodDecorator & ClassDecorator => CanMarker(keys);
