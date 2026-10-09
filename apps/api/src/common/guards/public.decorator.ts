import { Reflector } from '@nestjs/core';

/** Read by `AuthGuard` (and Task 12's route walk). */
export const PublicMarker = Reflector.createDecorator<true>();

/**
 * Access marker: the route needs no session (`/health/*`, `/openapi.json`, `/webhooks/ses` and
 * the tenant-less sign-in routes, D16). Every route carries exactly one of `@Public`,
 * `@PreAuth`, `@Authenticated`, `@Can` and `@PlatformRole` (ruling F02).
 */
export const Public = (): MethodDecorator & ClassDecorator => PublicMarker(true);
