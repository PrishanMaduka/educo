import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { AppErrorFilter } from './common/error.filter';
import { requestIdFrom, runWithRequestContext } from './common/request-context';
import { PinoNestLogger, createLogger } from './observability/logger';

import type { Config } from './config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Logger } from 'pino';

export interface CreateAppOptions {
  /** Defaults to a pino logger at `LOG_LEVEL` writing JSON to stdout. */
  readonly logger?: Logger;
}

/**
 * Builds and initialises the API (Nest on Fastify) with the `/api/v1` prefix, the request
 * context, request logging and the error mapping. Does not listen; `main.ts` does.
 */
export async function createApp(
  config: Config,
  options: CreateAppOptions = {},
): Promise<NestFastifyApplication> {
  const logger = options.logger ?? createLogger(config, 'api');
  const adapter = new FastifyAdapter({
    // A safe incoming x-request-id or a new UUID; Fastify's own logger stays off (we log with pino).
    // Signals are handled in main.ts so tracing is flushed after the app closes.
    genReqId: (request: { headers: Record<string, string | string[] | undefined> }) =>
      requestIdFrom(request.headers['x-request-id']),
    requestIdHeader: false,
    // Behind CloudFront and the ALB (spec 20); needed for client IPs in rate limits.
    trustProxy: config.APP_ENV !== 'local',
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(config, logger),
    adapter,
    { logger: new PinoNestLogger(logger), abortOnError: false },
  );
  app.setGlobalPrefix('api/v1');
  // Also receives Fastify's own errors (malformed JSON, body too large): Nest installs a Fastify
  // error handler that rethrows them as HttpExceptions through the global filters.
  app.useGlobalFilters(new AppErrorFilter(logger));

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', (request, reply, done) => {
    void reply.header('x-request-id', request.id);
    runWithRequestContext(request.id, done);
  });
  fastify.addHook('onResponse', (request, reply, done) => {
    // The route template, never the raw URL: paths can carry signed-link tokens.
    logger.info(
      {
        method: request.method,
        route: request.routeOptions.url ?? 'unmatched',
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      'Request completed',
    );
    done();
  });

  await app.init();
  return app;
}
