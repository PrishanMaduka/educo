import 'reflect-metadata';

import { randomBytes } from 'node:crypto';

import { Controller, Get, Injectable, Module, Post } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import pino from 'pino';

import { AppErrorFilter } from '../../src/common/error.filter';
import { RateLimit } from '../../src/common/rate-limit/rate-limit.decorator';
import { RateLimitModule } from '../../src/common/rate-limit/rate-limit.module';
import { currentRequestContext, runWithRequestContext } from '../../src/common/request-context';
import { loadConfig } from '../../src/config';
import { CoreModule } from '../../src/core.module';
import { RedisModule } from '../../src/redis/redis.module';
import { localEnv } from '../env';

import type { Clock } from '../../src/tokens';
import type { CanActivate, DynamicModule, ExecutionContext } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import type { Logger } from 'pino';

/** The probe's per-email key function, as Task 7's identify route will write it. */
export function emailOf(request: FastifyRequest): string | undefined {
  const body: unknown = request.body;
  if (typeof body !== 'object' || body === null || !('email' in body)) return undefined;
  return typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
}

/** Stands in for Task 6's auth guard: puts the `x-test-user` header into the request context. */
@Injectable()
class TestUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const header = context.switchToHttp().getRequest<FastifyRequest>().headers['x-test-user'];
    const ctx = currentRequestContext();
    if (ctx && typeof header === 'string') ctx.userId = header;
    return true;
  }
}

@Controller()
class ProbeController {
  @Post('auth/probe')
  auth(): { ok: true } {
    return { ok: true };
  }

  @Post('platform/auth/probe')
  platformAuth(): { ok: true } {
    return { ok: true };
  }

  @Get('school/probe')
  school(): { ok: true } {
    return { ok: true };
  }

  @Post('probe/email')
  @RateLimit({ limit: 3, windowSeconds: 900, key: emailOf })
  perEmail(): { ok: true } {
    return { ok: true };
  }

  // Evaluated top to bottom: the IP limit first, then the per-email one.
  @Post('probe/stacked')
  @RateLimit({ limit: 2, windowSeconds: 60 })
  @RateLimit({ limit: 5, windowSeconds: 60, key: emailOf })
  stacked(): { ok: true } {
    return { ok: true };
  }
}

@Module({})
class ProbeModule {
  static register(redisUrl: string, clock: Clock, logger: Logger): DynamicModule {
    const config = loadConfig(localEnv({ REDIS_URL: redisUrl }));
    return {
      module: ProbeModule,
      imports: [CoreModule.forRoot(config, logger, clock), RedisModule, RateLimitModule],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: TestUserGuard }],
    };
  }
}

/**
 * A small Nest app with the real Redis and rate-limit modules and probe routes under `/api/v1`
 * (the real app has no rate-limited routes until Task 7).
 */
export async function createProbeApp(
  redisUrl: string,
  clock: Clock,
  logger: Logger = pino({ level: 'silent' }),
): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    ProbeModule.register(redisUrl, clock, logger),
    new FastifyAdapter(),
    { logger: false },
  );
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new AppErrorFilter(logger));
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, _reply, done) => {
      runWithRequestContext(request.id, done);
    });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

/** A fresh client address per test, so reruns within a minute never share a counter. */
export const randomIp = (): string => `10.${[...randomBytes(3)].join('.')}`;
