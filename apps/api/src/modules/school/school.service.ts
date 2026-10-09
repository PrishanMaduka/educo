import { Inject, Injectable } from '@nestjs/common';
import { parseOfficePhone, planSchoolProfileChange } from '@quad/domain';

import { AuditService, auditActorOf } from '../../common/audit/audit.service';
import { formatMessage } from '../../common/delivery/templates/render';
import { NotFoundError, StaleVersionError, ValidationError } from '../../common/errors';
import { assertIfMatch } from '../../common/etag/etag';
import { schoolOf } from '../../common/session/request-auth';
import { TENANT_DB } from '../../tokens';

import {
  generalEtag,
  generalOf,
  toSchool,
  toSchoolBranding,
  toSchoolSettings,
} from './school.mapper';
import { SchoolRepository } from './school.repository';

import type { SettingsRow } from './school.repository';
import type { RequestAuth } from '../../common/session/request-auth';
import type { School, SchoolBranding, SchoolSettings, SchoolUpdateInput } from '@quad/contracts';
import type { QuadTenantDb, TenantProfile, TenantTx } from '@quad/db';
import type { SchoolProfileField, SchoolProfileInput, SchoolProfileValues } from '@quad/domain';

/** The values of `fields`, for the audit entry. */
const valuesOf = (values: SchoolProfileValues, fields: readonly SchoolProfileField[]) =>
  Object.fromEntries(fields.map((field) => [field, values[field]]));

/**
 * Settings → School settings (spec 06, 08): General, the school's branding and its other
 * settings, read-only in M1 apart from General. The name is the school's own row, changed only
 * through `update_current_tenant_name`; everything else is `school_settings`. The time zone,
 * branding and sign-in rules are Quad's and never change here (the contract refuses them).
 */
@Injectable()
export class SchoolService {
  constructor(
    @Inject(TENANT_DB) private readonly db: QuadTenantDb,
    private readonly repository: SchoolRepository,
    private readonly audit: AuditService,
  ) {}

  /** `GET /school`. */
  get(auth: RequestAuth): Promise<School> {
    const { tenantId } = schoolOf(auth);
    return this.db.withTenant(tenantId, async (tx) => {
      const settings = await this.repository.settings(tx, tenantId, { forUpdate: false });
      return toSchool(settings, await this.profileIn(tx));
    });
  }

  /**
   * `PATCH /school`: checks the office phone against the school's own country (D35), refuses a
   * stale `If-Match` (409), stores what changed and audits it as `settings.updated` with the
   * field names and their values before and after, in one transaction. Sending the values it
   * already has changes nothing and writes no audit entry.
   */
  async update(
    auth: RequestAuth,
    input: SchoolUpdateInput,
    ifMatch: string,
    ip: string,
  ): Promise<School> {
    const actor = auditActorOf(schoolOf(auth), ip);
    return this.db.withTenant(actor.tenantId, async (tx) => {
      const settings = await this.repository.settings(tx, actor.tenantId, { forUpdate: true });
      const profile = await this.profileIn(tx);
      const change = this.checked(input, profile.country);
      const current = generalOf(settings, profile);
      assertIfMatch(ifMatch, generalEtag(current));
      const { next, fields } = planSchoolProfileChange(current, change);
      if (fields.length === 0) return toSchool(settings, profile);
      if (fields.includes('name')) await this.rename(tx, settings, profile, next.name);
      const { name, ...own } = next;
      const saved = fields.some((field) => field !== 'name')
        ? await this.repository.saveGeneral(tx, actor.tenantId, own, actor.userId)
        : settings;
      await this.audit.record(
        { tx, ...actor },
        'settings.updated',
        { type: 'school', id: actor.tenantId },
        { fields, before: valuesOf(current, fields), after: valuesOf(next, fields) },
      );
      return toSchool(saved, { ...profile, name });
    });
  }

  /** `GET /school/branding`. */
  branding(auth: RequestAuth): Promise<SchoolBranding> {
    const { tenantId } = schoolOf(auth);
    return this.db.withTenant(tenantId, async (tx) => toSchoolBranding(await this.profileIn(tx)));
  }

  /** `GET /settings`. */
  settings(auth: RequestAuth): Promise<SchoolSettings> {
    const { tenantId } = schoolOf(auth);
    return this.db.withTenant(tenantId, async (tx) =>
      toSchoolSettings(await this.repository.settings(tx, tenantId, { forUpdate: false })),
    );
  }

  /**
   * Renames the school only while it still has the name this change read: a rename from the
   * console committed meanwhile wins, and this change gets 409 with the version that has it.
   */
  private async rename(
    tx: TenantTx,
    settings: SettingsRow,
    read: TenantProfile,
    name: string,
  ): Promise<void> {
    if (await this.db.definers.updateCurrentTenantName(tx, { expected: read.name, name })) return;
    throw new StaleVersionError(generalEtag(generalOf(settings, await this.profileIn(tx))));
  }

  private async profileIn(tx: TenantTx): Promise<TenantProfile> {
    const profile = await this.db.definers.currentTenantProfile(tx);
    if (profile === null) throw new NotFoundError();
    return profile;
  }

  /** The input with the office phone in E.164 for `country`, or 400 on `officePhone`. */
  private checked(input: SchoolUpdateInput, country: string): SchoolProfileInput {
    if (input.officePhone === undefined || input.officePhone === null) return input;
    const phone = parseOfficePhone(country, input.officePhone);
    if (!phone.ok) {
      throw new ValidationError({ officePhone: formatMessage('error.school.officePhoneInvalid') });
    }
    return { ...input, officePhone: phone.e164 };
  }
}
