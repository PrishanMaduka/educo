import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { ValidationError } from '../../common/errors';
import { Public } from '../../common/guards/public.decorator';

import { SesWebhookService } from './ses-webhook.service';

import type { PipeTransform } from '@nestjs/common';
import type { SesWebhookAck } from '@quad/contracts';

/**
 * SNS posts its JSON as `text/plain`, which Fastify hands over as a string; `application/json`
 * arrives already parsed. Anything that is not JSON is a 400.
 */
class SnsJsonBodyPipe implements PipeTransform<unknown, unknown> {
  transform(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new ValidationError({ _root: 'The body must be an SNS message in JSON.' });
    }
  }
}

// Public: no session and no @Can. The SNS topic and signature are the check, done in the
// service before anything is fetched or written. It is also the one route that accepts a
// `text/plain` body (SNS sends JSON that way; createApp refuses it everywhere else).
@Controller('webhooks')
export class SesWebhookController {
  constructor(private readonly webhook: SesWebhookService) {}

  @Post('ses')
  @Public()
  @HttpCode(200)
  receive(@Body(new SnsJsonBodyPipe()) body: unknown): Promise<SesWebhookAck> {
    return this.webhook.receive(body);
  }
}
