import { Reflector } from '@nestjs/core';

/** Read by `AuthGuard`, which leaves these classes to `PlatformSessionGuard` (Task 10). */
export const PlatformControllerMarker = Reflector.createDecorator<true>();

/**
 * Marks a controller in `src/platform/**`: console routes, authenticated by the console cookie
 * and `@PlatformRole` (Task 10), never by the staff session (ruling F39).
 */
export const PlatformController = (): ClassDecorator => PlatformControllerMarker(true);
