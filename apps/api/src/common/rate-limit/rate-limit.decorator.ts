import type { FastifyRequest } from 'fastify';

/** One limit on a route: at most `limit` requests per `windowSeconds` for one subject. */
export interface RateLimitRule {
  readonly limit: number;
  readonly windowSeconds: number;
  /**
   * The subject to count, from the request (for example the email in the body); the client IP
   * when omitted. The value is HMAC-hashed before it reaches Redis, so return it as is (trimmed
   * and lower-cased where that makes two spellings one subject). Returning undefined or '' skips
   * this rule for the request (the body's validation then answers 400).
   */
  readonly key?: (request: FastifyRequest) => string | undefined;
}

/** Rules by route handler (a WeakMap rather than reflect metadata, so reads stay typed). */
const RULES = new WeakMap<object, readonly RateLimitRule[]>();

/**
 * Adds a rate limit to a route, on top of the global ones (20 per minute per IP on `/auth/*`
 * and `/platform/auth/*`, 600 per minute per user). Stack several to limit several subjects;
 * they are checked top to bottom, and the first refusal answers 429 `rate_limited` with
 * `Retry-After` (later rules are not counted).
 */
export function RateLimit(rule: RateLimitRule): MethodDecorator {
  if (!Number.isInteger(rule.limit) || rule.limit < 1) {
    throw new Error('A rate limit needs a whole number of requests, 1 or more.');
  }
  if (!Number.isInteger(rule.windowSeconds) || rule.windowSeconds < 1) {
    throw new Error('A rate-limit window needs a whole number of seconds, 1 or more.');
  }
  return (_target, _property, descriptor) => {
    const handler: unknown = descriptor.value;
    if (typeof handler !== 'function') {
      throw new Error('@RateLimit goes on a route handler method.');
    }
    // Decorators apply bottom-up, so prepending keeps the rules in source order.
    RULES.set(handler, [rule, ...rateLimitRulesOf(handler)]);
  };
}

/** The `@RateLimit` rules on a route handler, top first. */
export function rateLimitRulesOf(handler: object): readonly RateLimitRule[] {
  return RULES.get(handler) ?? [];
}
