import { Reflector } from '@nestjs/core';

import type { SessionStage } from '@quad/contracts';

/** Read by `AuthGuard` (and Task 12's route walk). */
export const PreAuthMarker = Reflector.createDecorator<readonly SessionStage[]>();

/**
 * Access marker: a sign-in step. The route needs a session at one of `stages` (for example
 * `@PreAuth('two_step')` for the code step); any other session, or none, is a 401.
 */
export const PreAuth = (
  ...stages: [SessionStage, ...SessionStage[]]
): MethodDecorator & ClassDecorator => PreAuthMarker(stages);
