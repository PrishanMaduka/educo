import { Reflector } from '@nestjs/core';

import type { PlatformRole as PlatformRoleName } from '@quad/contracts';

/** Read by `PlatformSessionGuard` (and Task 12's route walk): the roles a console route allows. */
export const PlatformRoleMarker = Reflector.createDecorator<readonly PlatformRoleName[]>();

/**
 * Access marker for console routes (spec 05 → Platform roles; spec 06: "`/platform` routes check
 * the platform role"): an active console session whose user has one of `roles`, or any role when
 * none is named (`@PlatformRole()`). Deny by default: a route in a `@PlatformController()` class
 * with no `@Public`, `@PreAuth` or `@PlatformRole` is refused for everyone, and `@PlatformRole`
 * outside such a class refuses every request.
 */
export const PlatformRole = (...roles: PlatformRoleName[]): MethodDecorator & ClassDecorator =>
  PlatformRoleMarker(roles);

/** Read by `PlatformSessionGuard`. */
export const DuringConsoleSignInMarker = Reflector.createDecorator<true>();

/**
 * Lets a `@PlatformRole()` route also take a console session still at a sign-in step (the
 * authenticator code or its set-up). Only `POST /platform/auth/sign-out` carries it. It is not an
 * access marker.
 */
export const DuringConsoleSignIn = (): MethodDecorator => DuringConsoleSignInMarker(true);
