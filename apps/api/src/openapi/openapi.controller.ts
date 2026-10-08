import { Controller, Get } from '@nestjs/common';

import { buildOpenApiDocument } from './document';

import type { OpenApiDocument } from './document';

@Controller()
export class OpenApiController {
  private readonly document = buildOpenApiDocument();

  // Public: the mobile app and client generators read it (spec 06, D15).
  @Get('openapi.json')
  get(): OpenApiDocument {
    return this.document;
  }
}
