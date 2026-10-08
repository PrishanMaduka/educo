import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, LOGGER } from '../../tokens';
import { RateLimitedError } from '../errors';
import { currentRequestContext } from '../request-context';

import { rateLimitRulesOf } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

import type { Clock } from '../../tokens';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import type { Observable } from 'rxjs';

/** Spec 06 → Rate limits: sign-in routes per IP, and every route per signed-in user. */
export const AUTH_IP_LIMIT = { limit: 20, windowSeconds: 60 } as const;
export const USER_LIMIT = { limit: 600, windowSeconds: 60 } as const;

/** Staff and parent sign-in (`/auth/*`) and console sign-in (`/platform/auth/*`), after `/api/v1`. */
const AUTH_ROUTE = /^\/api\/v1\/(?:platform\/)?auth\//;

interface Check {
  readonly key: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

/**
 * Applies the global limits and each route's `@RateLimit` rules, in that order: the per-IP limit
 * shared by every sign-in route (one bucket per IP for `/auth/*` and `/platform/auth/*`), the
 * route's own rules (top first, counted per route template), then the per-user limit.
 *
 * If Redis cannot answer, the request goes on and the API logs the `rate_limit_unavailable`
 * metric (fail open, D32): sign-in stays available, and lockout and the edge's WAF limits still
 * apply.
 */
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly limits: RateLimitService,
    @Inject(CLOCK) private readonly now: Clock,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const checks = this.checksFor(request, context.getHandler());
    try {
      for (const check of checks) {
        const result = await this.limits.hit(
          check.key,
          check.limit,
          check.windowSeconds,
          this.now(),
        );
        if (!result.allowed) throw new RateLimitedError(result.retryAfter);
      }
    } catch (error) {
      if (error instanceof RateLimitedError) throw error;
      this.logger.warn(
        {
          metric: 'rate_limit_unavailable',
          reason: error instanceof Error ? error.name : 'unknown',
        },
        'Rate limits skipped: Redis did not answer',
      );
    }
    return next.handle();
  }

  private checksFor(request: FastifyRequest, handler: object): Check[] {
    // The route template, never the raw URL (paths can carry signed-link tokens).
    const route = `${request.method} ${request.routeOptions.url ?? 'unmatched'}`;
    const checks: Check[] = [];
    if (AUTH_ROUTE.test(request.routeOptions.url ?? '')) {
      // One bucket per IP for the whole sign-in family (spec 06), not one per route.
      checks.push({ key: `ip:auth:${request.ip}`, ...AUTH_IP_LIMIT });
    }
    rateLimitRulesOf(handler).forEach((rule, index) => {
      const subject = rule.key === undefined ? request.ip : rule.key(request);
      if (subject === undefined || subject === '') return;
      const keyed =
        rule.key === undefined ? `ip:${subject}` : `h:${this.limits.hashSubject(subject)}`;
      checks.push({
        key: `route:${route}#${index}:${keyed}`,
        limit: rule.limit,
        windowSeconds: rule.windowSeconds,
      });
    });
    const userId = currentRequestContext()?.userId;
    if (userId !== undefined && userId !== null) {
      checks.push({ key: `user:${userId}`, ...USER_LIMIT });
    }
    return checks;
  }
}
