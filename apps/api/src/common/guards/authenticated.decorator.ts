import { Reflector } from '@nestjs/core';

import type { SessionStage } from '@quad/contracts';

export interface AuthenticatedOptions {
  /**
   * Sign-in stages also accepted besides an active session: `POST /auth/select-school` takes
   * `choose_school`, and `POST /auth/sign-out` every stage (Task 7).
   */
  readonly alsoAtStages?: readonly SessionStage[];
}

/** Read by `AuthGuard` (and Task 12's route walk). */
export const AuthenticatedMarker = Reflector.createDecorator<AuthenticatedOptions>();

/**
 * Access marker: an active session (or, from Task 9, a valid bearer token) and no permission
 * check, for self-scoped routes only. In M1 exactly: `/me*`, `/auth/sign-out`,
 * `/auth/select-school` and `/school/branding` (ruling F02, D32).
 */
export const Authenticated = (
  options: AuthenticatedOptions = {},
): MethodDecorator & ClassDecorator => AuthenticatedMarker(options);
