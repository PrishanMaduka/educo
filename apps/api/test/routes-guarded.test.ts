import { Controller, Delete, Get, Module, Post } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { Authenticated } from '../src/common/guards/authenticated.decorator';
import { Can } from '../src/common/guards/can.decorator';
import { PlatformController } from '../src/common/guards/platform-controller.decorator';
import { AllowDuringPreview } from '../src/common/guards/preview-read-only.guard';
import { Public } from '../src/common/guards/public.decorator';
import { RelativeAccess } from '../src/common/guards/relative-access.decorator';
import { routeProblems, walkRoutes } from '../src/common/guards/route-markers';
import { Sensitive } from '../src/common/guards/sensitive.decorator';
import { AllowWhileSuspended } from '../src/common/guards/tenant-status.guard';
import { loadConfig } from '../src/config';
import { API_ROUTES } from '../src/openapi/document';
import { PlatformRole } from '../src/platform/auth/platform-roles.decorator';

import { CLOSED_PORTS, useTestApp } from './app';
import { localEnv } from './env';

import type { Type } from '@nestjs/common';

/** Every route Fastify registers, as `GET /api/v1/x`, collected by an onRoute hook. */
const served: string[] = [];
const app = useTestApp(CLOSED_PORTS, {
  beforeInit: (fastify) => {
    fastify.addHook('onRoute', (route) => {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      for (const method of methods) {
        if (method !== 'HEAD') served.push(`${method} ${route.url}`);
      }
    });
  },
});

function appControllers(): Type[] {
  return app()
    .get(DiscoveryService)
    .getControllers()
    .map((wrapper) => wrapper.metatype)
    .filter((metatype): metatype is Type => typeof metatype === 'function');
}

const documented = () =>
  API_ROUTES.map((route) => `${route.method.toUpperCase()} ${route.path}`).sort();

describe('every route is guarded (Task 12 route walk, ruling F02)', () => {
  it('walks the same routes the router serves and the OpenAPI document lists', () => {
    const walked = walkRoutes(appControllers())
      .map((route) => route.route)
      .sort();
    const routed = served
      .map((route) => route.replace(' /api/v1', ' ').replace(/:(\w+)/g, '{$1}'))
      .sort();
    expect(walked).toEqual(routed);
    expect(walked).toEqual(documented());
  });

  it('finds exactly one access marker on every route, and every rule kept', () => {
    expect(routeProblems(walkRoutes(appControllers()))).toEqual([]);
  });

  it('puts the marker each M1 route needs', () => {
    const marker = Object.fromEntries(
      walkRoutes(appControllers()).map((route) => [route.route, route.access[0]]),
    );
    expect(marker).toMatchObject({
      'GET /me': 'authenticated',
      'GET /me/permissions': 'authenticated',
      'POST /me/role-preview': 'can',
      'DELETE /me/role-preview': 'authenticated',
      'POST /me/totp': 'preAuth',
      'POST /auth/sign-out': 'authenticated',
      'GET /health/live': 'public',
      'GET /platform/me': 'platformRole',
    });
  });
});

// Rogue controllers: the positive control that the walk catches each kind of mistake.
@Controller('rogue')
class RogueController {
  @Get('none')
  none(): void {}

  @Get('two')
  @Public()
  @Can('fees.view')
  two(): void {}

  @Get('fees')
  @Authenticated()
  fees(): void {}

  @Get('sensitive')
  @Public()
  @Sensitive('medical')
  sensitive(): void {}

  @Post('suspended')
  @Can('fees.view')
  @AllowWhileSuspended()
  suspended(): void {}

  @Delete('preview')
  @Can('fees.view')
  @AllowDuringPreview()
  preview(): void {}

  @Get('relative')
  @Public()
  @RelativeAccess()
  relative(): void {}

  @Get('platform-role')
  @PlatformRole()
  platformRole(): void {}
}

@PlatformController()
@Controller('platform/rogue')
class RogueConsoleController {
  @Get()
  @Can('fees.view')
  can(): void {}
}

describe('the route walk itself', () => {
  it('reports every kind of mistake', () => {
    const problems = routeProblems(walkRoutes([RogueController, RogueConsoleController]));
    const expected = [
      'GET /rogue/none',
      'GET /rogue/two',
      'GET /rogue/fees',
      'GET /rogue/sensitive',
      'POST /rogue/suspended',
      'DELETE /rogue/preview',
      'GET /rogue/relative',
      'GET /rogue/platform-role',
      'GET /platform/rogue',
    ];
    for (const route of expected) {
      expect(
        problems.some((problem) => problem.startsWith(`${route} `)),
        route,
      ).toBe(true);
    }
    expect(problems).toHaveLength(expected.length);
  });
});

@Controller('rogue/boot')
class UnmarkedController {
  @Get()
  unmarked(): void {}
}

@Module({ controllers: [UnmarkedController] })
class UnmarkedModule {}

@Controller('rogue/role')
class MisplacedRoleController {
  @Get()
  @PlatformRole()
  misplaced(): void {}
}

@Module({ controllers: [MisplacedRoleController] })
class MisplacedRoleModule {}

@PlatformController()
@Controller('platform/rogue-boot')
class UnmarkedConsoleController {
  @Get()
  unmarked(): void {}
}

@Module({ controllers: [UnmarkedConsoleController] })
class UnmarkedConsoleModule {}

describe('the route walk at boot (fix round 1, M1)', () => {
  const boot = (testModule: Type) =>
    createApp(loadConfig(localEnv(CLOSED_PORTS)), {
      logger: pino({ level: 'silent' }),
      overrides: { testModules: [testModule] },
    }).then(async (made) => {
      await made.close();
      return 'started';
    });

  it.each([
    [UnmarkedModule, 'GET /rogue/boot (UnmarkedController.unmarked) carries 0 access markers'],
    [MisplacedRoleModule, 'has @PlatformRole outside a console controller'],
    [UnmarkedConsoleModule, 'GET /platform/rogue-boot (UnmarkedConsoleController.unmarked)'],
  ])('refuses to start with %o', async (testModule, problem) => {
    await expect(boot(testModule)).rejects.toThrow(problem);
  });
});
