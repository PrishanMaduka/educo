import { Controller, Get, Res } from '@nestjs/common';

import { ReadinessService } from './readiness.service';

import type { HealthLive, HealthReady } from '@quad/contracts';
import type { FastifyReply } from 'fastify';

// Public probes for the load balancer and ECS (no session, no tenant).
@Controller('health')
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get('live')
  live(): HealthLive {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) reply: FastifyReply): Promise<HealthReady> {
    const result = await this.readiness.check();
    if (result.status === 'down') {
      void reply.status(503);
    }
    return result;
  }
}
