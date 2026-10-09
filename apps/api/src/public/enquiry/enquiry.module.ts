import { Module } from '@nestjs/common';

import { EnquiryController } from './enquiry.controller';
import { EnquiryService } from './enquiry.service';

/** The public admissions enquiry form's entry point (spec 06 Public; completed in M4). */
@Module({ controllers: [EnquiryController], providers: [EnquiryService] })
export class EnquiryModule {}
