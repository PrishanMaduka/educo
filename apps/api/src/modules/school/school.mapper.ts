import { settingsSummary } from '@quad/domain';

import { brandPalette } from '../../common/branding/brand-palette';
import { etagOf } from '../../common/etag/etag';

import type { SettingsRow } from './school.repository';
import type { School, SchoolBranding, SchoolSettings } from '@quad/contracts';
import type { TenantProfile } from '@quad/db';
import type { SchoolProfileValues } from '@quad/domain';

/** A `time` column (`HH:mm:ss`) as the school-local `HH:mm` responses use (spec 06). */
const localTime = (value: string): string => value.slice(0, 5);

/** General's own values: the name from the school, the rest from its settings. */
export function generalOf(settings: SettingsRow, profile: TenantProfile): SchoolProfileValues {
  return {
    name: profile.name,
    officeEmail: settings.officeEmail,
    officePhone: settings.officePhone,
    address: settings.address,
    smsSenderId: settings.smsSenderId,
    smsSenderStatus: settings.smsSenderStatus,
  };
}

/** The version of General a change must name in `If-Match`: its editable values only. */
export const generalEtag = (general: SchoolProfileValues): string => etagOf(general);

/** The logo and colour set in the console. Logos become files in M4: no URL until then. */
export function toSchoolBranding(profile: TenantProfile): SchoolBranding {
  return { color: brandPalette(profile.brandColor).color, logoUrl: null };
}

export function toSchool(settings: SettingsRow, profile: TenantProfile): School {
  const general = generalOf(settings, profile);
  return {
    ...general,
    shortName: profile.shortName,
    timeZone: profile.timeZone,
    branding: toSchoolBranding(profile),
    signIn: {
      twoStep: profile.twoStep,
      passwordMinLength: profile.passwordMinLength,
      sessionHours: profile.sessionHours,
      ipAllowlist: [...profile.ipAllowlist],
    },
    summary: settingsSummary(
      {
        askQuadEnabled: settings.askQuadEnabled,
        quietHoursEnabled: settings.quietHoursEnabled,
        quietFrom: localTime(settings.quietFrom),
        quietUntil: localTime(settings.quietUntil),
        quietWeekends: settings.quietWeekends,
      },
      general,
    ),
    etag: generalEtag(general),
  };
}

export function toSchoolSettings(settings: SettingsRow): SchoolSettings {
  return {
    askQuadEnabled: settings.askQuadEnabled,
    askQuadKeepConversations: settings.askQuadKeepConversations,
    ewShareWithParents: settings.ewShareWithParents,
    absenceAlert: settings.absenceAlert,
    absenceAlertTime: localTime(settings.absenceAlertTime),
    reminderDays: [...settings.reminderDays],
    photoConsentDefault: settings.photoConsentDefault,
    familyCircleEnabled: settings.familyCircleEnabled,
    quietHoursEnabled: settings.quietHoursEnabled,
    quietFrom: localTime(settings.quietFrom),
    quietUntil: localTime(settings.quietUntil),
    quietWeekends: settings.quietWeekends,
    updatedAt: settings.updatedAt.toISOString(),
  };
}
