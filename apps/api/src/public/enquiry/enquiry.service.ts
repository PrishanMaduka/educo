import { Inject, Injectable } from '@nestjs/common';

import { NotFoundError } from '../../common/errors';
import { TENANT_DB } from '../../tokens';

import type { EnquiryInput } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';

/**
 * The public admissions enquiry (spec 05 Tenant-less entry points; spec 06), a stub until M4. The
 * school comes only from `tenant_by_embed_key`, itself a stub that finds nothing, so every key is
 * unknown: 404 `not_found`. M4 opens `withTenant` with the form's school only after this lookup
 * (and the captcha, spec 06), and creates the lead or applicant from the parsed body.
 */
@Injectable()
export class EnquiryService {
  constructor(@Inject(TENANT_DB) private readonly db: QuadTenantDb) {}

  async submit(request: {
    readonly embedKey: string;
    /** Stored from M4; the stub only parses it. */
    readonly enquiry: EnquiryInput;
  }): Promise<void> {
    const { embedKey } = request;
    const form = await this.db.definers.tenantByEmbedKey(embedKey);
    if (form === null || !form.active) throw new NotFoundError();
    // TODO(M4): store the enquiry under withTenant(form.tenantId) once enquiry_forms exist.
    throw new NotFoundError();
  }
}
