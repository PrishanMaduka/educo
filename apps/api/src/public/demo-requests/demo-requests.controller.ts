import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { DemoRequestBody } from '@quad/contracts';

import { Public } from '../../common/guards/public.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { ZodValidationPipe } from '../../common/zod.pipe';

import { DemoRequestsService } from './demo-requests.service';

import type { FastifyRequest } from 'fastify';

/** Spec 06 and 19: 5 an hour per IP. */
const PER_IP = { limit: 5, windowSeconds: 60 * 60 } as const;

/**
 * `POST /public/demo-requests` (spec 06, 19; D57): tenant-less and anonymous (D16). The checks run
 * in order: the per-IP limit (here), the body, then in the service the honeypot, Turnstile and
 * the per-email limit, then the lead is stored and its emails queued. The answer is the same 202
 * for a new lead, an updated one and a honeypot hit.
 */
@Controller('public/demo-requests')
export class DemoRequestsController {
  constructor(private readonly demoRequests: DemoRequestsService) {}

  @Post()
  @Public()
  @HttpCode(202)
  @RateLimit(PER_IP)
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
