import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { EmbedKeyParams, EnquiryInput } from '@quad/contracts';

import { Public } from '../../common/guards/public.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { ZodValidationPipe } from '../../common/zod.pipe';

import { EnquiryService } from './enquiry.service';

/** Spec 06: 20 requests per minute per IP, as the sign-in routes (the captcha arrives in M4). */
const PER_IP = { limit: 20, windowSeconds: 60 } as const;

/** `POST /public/enquiry/:embedKey`: tenant-less (D16); the school only from the embed key. */
@Controller('public/enquiry')
export class EnquiryController {
  constructor(private readonly enquiries: EnquiryService) {}

  @Post(':embedKey')
  @Public()
  @HttpCode(202)
  @RateLimit(PER_IP)
  async submit(
    @Param(new ZodValidationPipe(EmbedKeyParams)) params: EmbedKeyParams,
    @Body(new ZodValidationPipe(EnquiryInput)) body: EnquiryInput,
  ): Promise<void> {
    await this.enquiries.submit({ embedKey: params.embedKey, enquiry: body });
  }
}
