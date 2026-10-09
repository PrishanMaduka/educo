import { Reflector } from '@nestjs/core';

/** Read by `AuthGuard`. */
export const RelativeAccessMarker = Reflector.createDecorator<true>();

/**
 * Lets a relative's token (family circle, spec 12) reach the route. Without it a relative's
 * token gets 403 everywhere: in M1 relatives reach only `POST /auth/refresh` (public) and
 * `POST /auth/sign-out`; M9b adds the moments routes (D32). It is not an access marker but an
 * addition to one that reads the token: it stands only beside `@Authenticated` or `@Can`, which
 * the route walk (`test/routes-guarded.test.ts`, Task 12) checks.
 */
export const RelativeAccess = (): MethodDecorator & ClassDecorator => RelativeAccessMarker(true);
