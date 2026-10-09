import { Module } from '@nestjs/common';

import { GuardsProbeController } from './probe.controller';

/**
 * Test-only probe routes for the Task 12 guards (`AppOverrides.testModules`). `AppModule` never
 * imports it, so the OpenAPI document and the app are unchanged.
 */
@Module({ controllers: [GuardsProbeController] })
export class GuardsProbeModule {}
