import 'reflect-metadata';

import fastifyCookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { robotsTagFor } from '@quad/contracts/web-env';

import { AppModule } from './app.module';
import { AppErrorFilter, sendError } from './common/error.filter';
import { UnsupportedMediaTypeError } from './common/errors';
import { isNoStoreRoute } from './common/no-store';
import { requestIdFrom, runWithRequestContext } from './common/request-context';
import { PinoNestLogger, createLogger } from './observability/logger';
import { API_ROUTES } from './openapi/document';
import { API_PREFIX, routeBodyLimits } from './openapi/registry';

import type { AppOverrides } from './app.module';
import type { Config } from './config';
import type { ErrorReporter } from './observability/sentry';
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
  /** A fixed clock and replacements for outbound calls (tests only). */
  readonly overrides?: AppOverrides;
  /** Where unexpected (500) errors are reported; defaults to nowhere (`main.ts` passes Sentry's). */
  readonly reporter?: ErrorReporter;
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

/** The one route that takes a `text/plain` body: SNS posts its JSON that way (D28 follow-up). */
const TEXT_PLAIN_ROUTE = `POST ${API_PREFIX}/webhooks/ses`;
const TEXT_PLAIN = /^\s*text\/plain\s*(?:;|$)/i;

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
    // Signed-link tokens travel in paths (`/auth/invites/:token`, Task 13): about 200 characters,
    // over Fastify's default 100 (a 414). Twice the contracts' 2048 limit, so a longer token
    // still reaches its schema and gets the usual 400 `validation`.
    routerOptions: { maxParamLength: 4096 },
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(config, logger, options.overrides, options.reporter),
    adapter,
    { logger: new PinoNestLogger(logger), abortOnError: false },
  );
  app.setGlobalPrefix('api/v1');
  // Also receives Fastify's own errors (malformed JSON, body too large): Nest installs a Fastify
  // error handler that rethrows them as HttpExceptions through the global filters.
  app.useGlobalFilters(new AppErrorFilter(logger, options.reporter));

  const fastify = app.getHttpAdapter().getInstance();
  // Routes are registered during init, so this sees each one and applies its declared limit.
  const bodyLimits = routeBodyLimits(API_ROUTES);
  fastify.addHook('onRoute', (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      const limit = bodyLimits.get(`${method} ${route.url}`);
      if (limit !== undefined) route.bodyLimit = limit;
    }
  });
  fastify.addHook('onRequest', (request, reply, done) => {
    void reply.header('x-request-id', request.id);
    runWithRequestContext(request.id, done);
  });
  // A cross-site form can post `text/plain` without a CORS preflight, so with cookie sessions
  // it is refused before the body is read, everywhere but the SES webhook (D28 follow-up).
  fastify.addHook('onRequest', (request, reply, done) => {
    const contentType = request.headers['content-type'];
    const route = `${request.method} ${request.routeOptions.url ?? ''}`;
    if (contentType !== undefined && TEXT_PLAIN.test(contentType) && route !== TEXT_PLAIN_ROUTE) {
      sendError(new UnsupportedMediaTypeError(), reply, logger, options.reporter);
      return;
    }
    done();
  });
  // Sign-in answers, TOTP secrets and recovery codes are never stored by a browser or a proxy
  // (Task 10 fix round 1, M3): every /auth, /platform/auth and /me/totp response, errors included.
  fastify.addHook('onSend', (request, reply, payload, done) => {
    if (isNoStoreRoute(request.routeOptions.url)) {
      void reply.header('cache-control', 'no-store');
    }
    done(null, payload);
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

  // Session and CSRF cookies (spec 05, D32); none are signed: the session value is opaque.
  await app.register(fastifyCookie);
  options.beforeInit?.(fastify);
  await app.init();
  return app;
}
