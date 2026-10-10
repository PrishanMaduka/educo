import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { DemoRequestBody } from '@quad/contracts';

import { Public } from '../../common/guards/public.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { ZodValidationPipe } from '../../common/zod.pipe';

import { DemoRequestsService } from './demo-requests.service';

import type { FastifyRequest } from 'fastify';

/**
 * The per-email rate-limit subject: the body's email, trimmed, NFKC-normalised and lower-cased,
 * so `A@x.com`, ` a@x.com ` and a full-width spelling are one subject. `@RateLimit` stores only
 * its HMAC. Undefined skips the rule, and validation then answers 400.
 */
export function normalisedEmail(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('email' in body)) return undefined;
  const { email } = body;
  return typeof email === 'string' ? email.normalize('NFKC').trim().toLowerCase() : undefined;
}

/** Spec 06 and 19: 5 an hour per IP. */
const PER_IP = { limit: 5, windowSeconds: 60 * 60 } as const;
/** OQ4: 3 a day per email, so the confirmation cannot be used to flood an inbox. */
const PER_EMAIL = {
  limit: 3,
  windowSeconds: 24 * 60 * 60,
  key: (request: FastifyRequest) => normalisedEmail(request.body),
} as const;

/**
 * `POST /public/demo-requests` (spec 06, 19; D57): tenant-less and anonymous (D16). The checks run
 * in order: the per-IP limit, the per-email limit, the body, the honeypot, Turnstile, then the
 * lead is stored and its emails queued. The answer is the same 202 for a new lead, an updated
 * one and a honeypot hit.
 */
@Controller('public/demo-requests')
export class DemoRequestsController {
  constructor(private readonly demoRequests: DemoRequestsService) {}

  @Post()
  @Public()
  @HttpCode(202)
  @RateLimit(PER_IP)
  @RateLimit(PER_EMAIL)
  async submit(
    @Body(new ZodValidationPipe(DemoRequestBody)) body: DemoRequestBody,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    await this.demoRequests.submit({
      body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
