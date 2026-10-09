import { createParamDecorator } from '@nestjs/common';

import { UnauthorizedError } from '../../common/errors';

import type { ExecutionContext } from '@nestjs/common';
import type { PlatformRole, SessionStage } from '@quad/contracts';
import type { FastifyRequest } from 'fastify';

/**
 * A console session (spec 05 → Platform console): a `kind='console'` row of a platform user,
 * from the console cookie only. `stage` is `two_step` or `two_step_setup` until the authenticator
 * code is checked, then `active`.
 */
export interface ConsoleAuth {
  readonly kind: 'console';
  readonly sessionId: string;
  readonly platformUserId: string;
  readonly name: string;
  readonly role: PlatformRole;
  readonly stage: SessionStage;
  /** SHA-256 of the console cookie: the CSRF token is keyed on it. */
  readonly tokenHash: Buffer;
}

/** Set by `PlatformSessionGuard` once per request; a WeakMap keeps the read typed. */
const CONSOLE_AUTH_BY_REQUEST = new WeakMap<FastifyRequest, ConsoleAuth>();

export function attachConsoleAuth(request: FastifyRequest, auth: ConsoleAuth): void {
  CONSOLE_AUTH_BY_REQUEST.set(request, auth);
}

/**
 * The route's console session: `@Console() auth: ConsoleAuth`. Only on console routes the guard
 * authenticated (`@PreAuth`, `@PlatformRole`); elsewhere it answers 401.
 */
export const Console = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const auth = CONSOLE_AUTH_BY_REQUEST.get(context.switchToHttp().getRequest<FastifyRequest>());
  if (auth === undefined) {
    throw new UnauthorizedError();
  }
  return auth;
});
