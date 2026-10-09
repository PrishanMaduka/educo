import { Injectable } from '@nestjs/common';
import { eq, schoolSettings } from '@quad/db';

import type { SchoolSettings, TenantTx } from '@quad/db';
import type { SchoolProfileValues } from '@quad/domain';

/** The `school_settings` columns School settings reads (spec 08). */
const COLUMNS = {
  officeEmail: schoolSettings.officeEmail,
  officePhone: schoolSettings.officePhone,
  address: schoolSettings.address,
  smsSenderId: schoolSettings.smsSenderId,
  smsSenderStatus: schoolSettings.smsSenderStatus,
  askQuadEnabled: schoolSettings.askQuadEnabled,
  askQuadKeepConversations: schoolSettings.askQuadKeepConversations,
  ewShareWithParents: schoolSettings.ewShareWithParents,
  absenceAlert: schoolSettings.absenceAlert,
  absenceAlertTime: schoolSettings.absenceAlertTime,
  reminderDays: schoolSettings.reminderDays,
  photoConsentDefault: schoolSettings.photoConsentDefault,
  familyCircleEnabled: schoolSettings.familyCircleEnabled,
  quietHoursEnabled: schoolSettings.quietHoursEnabled,
  quietFrom: schoolSettings.quietFrom,
  quietUntil: schoolSettings.quietUntil,
  quietWeekends: schoolSettings.quietWeekends,
  updatedAt: schoolSettings.updatedAt,
} as const;

export type SettingsRow = Pick<SchoolSettings, keyof typeof COLUMNS>;

/** The school's `school_settings` row, always inside the caller's `withTenant` transaction. */
@Injectable()
export class SchoolRepository {
  /**
   * The school's settings. A school without its row yet (rows come with provisioning, M2) gets
   * one with the database defaults first, so the defaults live in one place (D32). `forUpdate`
   * locks it, so two changes to General run one after the other and `If-Match` stays true.
   */
  async settings(
    tx: TenantTx,
    tenantId: string,
    options: { readonly forUpdate: boolean },
  ): Promise<SettingsRow> {
    await tx.insert(schoolSettings).values({ tenantId }).onConflictDoNothing();
    const query = tx
      .select(COLUMNS)
      .from(schoolSettings)
      .where(eq(schoolSettings.tenantId, tenantId));
    const [row] = options.forUpdate ? await query.for('update') : await query;
    if (row === undefined) throw new Error('The school settings row was not written.');
    return row;
  }

  /** Stores General's own `school_settings` values (the name lives on `tenants`). */
  async saveGeneral(
    tx: TenantTx,
    tenantId: string,
    values: Omit<SchoolProfileValues, 'name'>,
    updatedBy: string | null,
  ): Promise<SettingsRow> {
    const [row] = await tx
      .update(schoolSettings)
      .set({ ...values, updatedBy })
      .where(eq(schoolSettings.tenantId, tenantId))
      .returning(COLUMNS);
    if (row === undefined) throw new Error('The school settings row was not updated.');
    return row;
  }
}
