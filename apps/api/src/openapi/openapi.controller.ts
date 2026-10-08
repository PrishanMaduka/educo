import { Controller, Get } from '@nestjs/common';

import { Public } from '../common/guards/public.decorator';

import { buildOpenApiDocument } from './document';

import type { OpenApiDocument } from './document';

@Controller()
export class OpenApiController {
  private readonly document = buildOpenApiDocument();

  // Public: the mobile app and client generators read it (spec 06, D15).
  @Get('openapi.json')
  @Public()
  get(): OpenApiDocument {
    return this.document;
  }
}
