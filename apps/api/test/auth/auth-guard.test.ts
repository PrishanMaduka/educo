import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../../src/common/guards/auth.guard';
import { CsrfTokens } from '../../src/common/session/csrf';

import type { RequestAuthenticator } from '../../src/common/session/request-auth';
import type { ExecutionContext } from '@nestjs/common';

class ProbeController {
  readonly area = 'probe';
}
const handler = (): string => 'ok';

/** A context of `type` whose handler and class carry no markers. */
function contextOf(type: 'http' | 'ws' | 'rpc'): ExecutionContext {
  const context = {
    getType: () => type,
    getHandler: () => handler,
    getClass: () => ProbeController,
    switchToHttp: () => ({ getRequest: () => ({ method: 'GET', headers: {}, cookies: {} }) }),
  };
  return context as unknown as ExecutionContext;
}

describe('AuthGuard outside HTTP', () => {
  it.each(['ws', 'rpc'] as const)(
    'refuses a %s context instead of letting it through',
    async (type) => {
      const fromRequest = vi.fn();
      const authenticator = { fromRequest } as unknown as RequestAuthenticator;
      const guard = new AuthGuard(new Reflector(), authenticator, new CsrfTokens('s'.repeat(32)));
      await expect(guard.canActivate(contextOf(type))).resolves.toBe(false);
      expect(fromRequest).not.toHaveBeenCalled();
    },
  );
});
