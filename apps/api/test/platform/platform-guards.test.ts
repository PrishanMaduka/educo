import { Controller, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { ForbiddenError } from '../../src/common/errors';
import { AuthGuard } from '../../src/common/guards/auth.guard';
import { PlatformController } from '../../src/common/guards/platform-controller.decorator';
import { Public } from '../../src/common/guards/public.decorator';
import { CsrfTokens } from '../../src/common/session/csrf';
import { loadConfig } from '../../src/config';
import { consoleFixedCode } from '../../src/platform/auth/console-fixed-code';
import { consoleRouteProblems } from '../../src/platform/auth/console-routes';
import { PlatformRole } from '../../src/platform/auth/platform-roles.decorator';
import { PlatformSessionGuard } from '../../src/platform/auth/platform-session.guard';
import { localEnv } from '../env';

import type { RequestAuthenticator } from '../../src/common/session/request-auth';
import type { ConsoleSessions } from '../../src/platform/auth/console-sessions.service';
import type { ExecutionContext, Type } from '@nestjs/common';

const config = loadConfig(localEnv());
const csrf = new CsrfTokens('s'.repeat(32));

class PlainController {
  plain(): string {
    return 'ok';
  }
}

@PlatformController()
class ConsoleController {
  marked(): string {
    return 'ok';
  }
}

class RoleOnHandlerController {
  @PlatformRole()
  marked(): string {
    return 'ok';
  }
}

function contextOf(
  type: 'http' | 'ws' | 'rpc',
  target: { readonly cls: Type; readonly handler: () => string },
  url = '/api/v1/probe',
): ExecutionContext {
  const context = {
    getType: () => type,
    getHandler: () => target.handler,
    getClass: () => target.cls,
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', headers: {}, cookies: {}, routeOptions: { url } }),
    }),
  };
  return context as unknown as ExecutionContext;
}

/** A route handler as Nest hands it to a guard (a function reference, never called). */
const handlerOf = (cls: Type, name: string): (() => string) =>
  Reflect.get(cls.prototype as object, name) as () => string;

const plain = { cls: PlainController, handler: handlerOf(PlainController, 'plain') };
const consoleTarget = { cls: ConsoleController, handler: handlerOf(ConsoleController, 'marked') };
const roleOnHandler = {
  cls: RoleOnHandlerController,
  handler: handlerOf(RoleOnHandlerController, 'marked'),
};

function platformGuard(): { guard: PlatformSessionGuard; authenticate: ReturnType<typeof vi.fn> } {
  const authenticate = vi.fn().mockResolvedValue(null);
  const sessions = { authenticate } as unknown as ConsoleSessions;
  return { guard: new PlatformSessionGuard(new Reflector(), sessions, csrf, config), authenticate };
}

describe('isolation by path: /api/v1/platform/* is always the console’s', () => {
  it('AuthGuard never authenticates a platform path, even without @PlatformController()', async () => {
    const fromRequest = vi.fn();
    const authenticator = { fromRequest } as unknown as RequestAuthenticator;
    const guard = new AuthGuard(new Reflector(), authenticator, csrf);
    await expect(
      guard.canActivate(contextOf('http', plain, '/api/v1/platform/anything')),
    ).resolves.toBe(true);
    expect(fromRequest).not.toHaveBeenCalled();
  });

  it('PlatformSessionGuard claims a platform path without @PlatformController() (403 with no marker)', async () => {
    const { guard } = platformGuard();
    await expect(
      guard.canActivate(contextOf('http', plain, '/api/v1/platform/anything')),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('PlatformSessionGuard leaves a school path without console markers alone', async () => {
    const { guard, authenticate } = platformGuard();
    await expect(guard.canActivate(contextOf('http', plain))).resolves.toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
  });
});

describe('PlatformSessionGuard outside HTTP', () => {
  it.each(['ws', 'rpc'] as const)(
    'lets a plain %s handler through (not a console route)',
    async (type) => {
      const { guard } = platformGuard();
      await expect(guard.canActivate(contextOf(type, plain))).resolves.toBe(true);
    },
  );

  it.each(['ws', 'rpc'] as const)(
    'refuses a console class or a console marker over %s',
    async (type) => {
      const { guard } = platformGuard();
      await expect(guard.canActivate(contextOf(type, consoleTarget))).resolves.toBe(false);
      await expect(guard.canActivate(contextOf(type, roleOnHandler))).resolves.toBe(false);
    },
  );
});

describe('consoleFixedCode (DEV_FIXED_OTP on the console: local only)', () => {
  it('is the fixed code locally when it is set', () => {
    expect(consoleFixedCode(loadConfig(localEnv({ DEV_FIXED_OTP: '000000' })))).toBe('000000');
  });

  it('is nothing when the variable is unset', () => {
    expect(consoleFixedCode(loadConfig(localEnv({ DEV_FIXED_OTP: undefined })))).toBeUndefined();
  });

  it('is nothing in staging, even when the variable is set', () => {
    expect(
      consoleFixedCode({
        ...loadConfig(localEnv({ DEV_FIXED_OTP: '000000' })),
        APP_ENV: 'staging',
      }),
    ).toBeUndefined();
  });
});

@PlatformController()
@Controller('platform/good')
class GoodConsole {
  @Get()
  @Public()
  get(): string {
    return 'ok';
  }
}

@Controller('platform/rogue')
class RogueSchoolController {
  @Get()
  get(): string {
    return 'ok';
  }
}

@Controller()
class RogueMethodController {
  @Get('platform/hidden')
  get(): string {
    return 'ok';
  }
}

@PlatformController()
@Controller('school-thing')
class MisplacedConsole {
  @Get()
  get(): string {
    return 'ok';
  }
}

@Controller('me')
class SchoolController {
  @Get()
  get(): string {
    return 'ok';
  }
}

describe('consoleRouteProblems (a path under platform/ if and only if @PlatformController())', () => {
  it('accepts console classes under platform/ and school classes elsewhere', () => {
    expect(consoleRouteProblems([GoodConsole, SchoolController])).toEqual([]);
  });

  it('names a class or a route under platform/ without @PlatformController(), and a console class elsewhere', () => {
    expect(
      consoleRouteProblems([RogueSchoolController, RogueMethodController, MisplacedConsole]),
    ).toEqual([
      'RogueSchoolController.get serves platform/rogue without @PlatformController()',
      'RogueMethodController.get serves platform/hidden without @PlatformController()',
      'MisplacedConsole.get is @PlatformController() but serves school-thing',
    ]);
  });
});
