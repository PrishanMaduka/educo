import { Controller, Get, Post } from '@nestjs/common';

import { Can } from '../../src/common/guards/can.decorator';
import { Module } from '../../src/common/guards/module.decorator';
import { Sensitive } from '../../src/common/guards/sensitive.decorator';

/**
 * Test-only routes behind the real guards (Task 12). Kept apart from `probe.module.ts` because
 * our `@Module` (a plan module) and Nest's `@Module` must never share a file.
 */
@Controller('probe/guards')
export class GuardsProbeController {
  @Get('fees')
  @Can('fees.view')
  fees(): { ok: true } {
    return { ok: true };
  }

  /** Any of the keys (`@Can` is any-of). */
  @Get('money')
  @Can('fees.view', 'finance.view')
  money(): { ok: true } {
    return { ok: true };
  }

  @Get('transport')
  @Can('transport.view')
  @Module('transport')
  transport(): { ok: true } {
    return { ok: true };
  }

  @Get('safeguarding')
  @Can('sis.view')
  @Sensitive('safeguarding')
  safeguarding(): { ok: true } {
    return { ok: true };
  }

  @Get('medical')
  @Can('sis.view')
  @Sensitive('medical')
  medical(): { ok: true } {
    return { ok: true };
  }

  /** A sensitive key support does hold: the positive control for the support refusal. */
  @Get('export')
  @Can('sis.view')
  @Sensitive('export_data')
  exportData(): { ok: true } {
    return { ok: true };
  }

  @Post('write')
  @Can('sis.view')
  write(): { ok: true } {
    return { ok: true };
  }
}
