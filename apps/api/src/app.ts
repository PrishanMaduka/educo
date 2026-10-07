import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { robotsTagFor } from '@quad/contracts/web-env';

import { AppModule } from './app.module';
import { AppErrorFilter } from './common/error.filter';
import { requestIdFrom, runWithRequestContext } from './common/request-context';
import { PinoNestLogger, createLogger } from './observability/logger';

import type { AppOverrides } from './app.module';
import type { Config } from './config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';

export interface CreateAppOptions {
  /** Defaults to a pino logger at `LOG_LEVEL` writing JSON to stdout. */
  readonly logger?: Logger;
  /**
   * Runs on the Fastify instance before Nest registers its routes. For tests and tooling only
   * (route listing, test-only routes); app behaviour belongs in modules.
   */
  readonly beforeInit?: (fastify: FastifyInstance) => void;
  /** Replacements for outbound calls (tests only). */
  readonly overrides?: AppOverrides;
}

/**
 * Trusts exactly `hops` proxies in front of the API (CloudFront + ALB on AWS, spec 20): the
 * socket peer and the next `hops - 1` X-Forwarded-For entries, read from the right. A client
 * therefore cannot choose its own IP with a forged leftmost entry. Fastify 5.12 refuses a plain
 * number (it cannot tell a proxy from a direct client), so this relies on the API being
 * reachable only through those proxies; 0 trusts nothing.
 */
function trustHops(hops: number): false | ((address: string, hop: number) => boolean) {
  return hops > 0 ? (_address, hop) => hop < hops : false;
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
    trustProxy: trustHops(config.TRUST_PROXY_HOPS),
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(config, logger, options.overrides),
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
  // Staging must not be indexed (spec 20); onSend also covers error and 404 responses.
  const robotsTag = robotsTagFor(config.APP_ENV, 'api');
  if (robotsTag !== null) {
    fastify.addHook('onSend', (_request, reply, payload, done) => {
      void reply.header('x-robots-tag', robotsTag);
      done(null, payload);
    });
  }
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

  options.beforeInit?.(fastify);
  await app.init();
  return app;
}
