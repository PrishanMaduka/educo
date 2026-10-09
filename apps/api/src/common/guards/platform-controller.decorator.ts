import { Reflector } from '@nestjs/core';

/** Read by `AuthGuard`, which leaves these classes to `PlatformSessionGuard` (Task 10). */
export const PlatformControllerMarker = Reflector.createDecorator<true>();

/**
 * Marks a controller in `src/platform/**`: console routes, authenticated by the console cookie
 * and `@PlatformRole` (Task 10), never by the staff session (ruling F39).
 */
export const PlatformController = (): ClassDecorator => PlatformControllerMarker(true);

/**
 * Console routes by path: `/api/v1/platform/*` (spec 06). Both guards decide by this as well as by
 * `@PlatformController()`, and `consoleRouteProblems` refuses to start the API when the two
 * disagree, so a school controller can never serve a console path or the reverse.
 */
export const PLATFORM_PATH = /^\/api\/v1\/platform(?:\/|$)/;

/** True for a route template under `/api/v1/platform/`. */
export function isPlatformPath(url: string | undefined): boolean {
  return url !== undefined && PLATFORM_PATH.test(url);
}
