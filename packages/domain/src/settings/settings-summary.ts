import type {
  SettingsSummary,
  SettingsSummaryNeed,
  SettingsSummaryPart,
  SmsSenderStatus,
} from '@quad/contracts';

/** The `school_settings` values the summary sentence reads. Times are school-local `HH:mm`. */
export interface SummarySettings {
  readonly askQuadEnabled: boolean;
  readonly quietHoursEnabled: boolean;
  readonly quietFrom: string;
  readonly quietUntil: string;
  readonly quietWeekends: boolean;
}

/** The General tab's values that say what needs doing. */
export interface SummaryProfile {
  readonly officeEmail: string | null;
  readonly smsSenderId: string | null;
  readonly smsSenderStatus: SmsSenderStatus | null;
}

function quietHours(settings: SummarySettings): SettingsSummaryPart {
  return settings.quietHoursEnabled
    ? {
        code: 'quiet_hours',
        from: settings.quietFrom,
        until: settings.quietUntil,
        weekends: settings.quietWeekends,
      }
    : { code: 'quiet_hours_off' };
}

function needs(profile: SummaryProfile): SettingsSummaryNeed[] {
  const out: SettingsSummaryNeed[] = [];
  if (profile.officeEmail === null) out.push({ code: 'add_office_email' });
  if (profile.smsSenderStatus === 'requested' && profile.smsSenderId !== null) {
    out.push({ code: 'sms_sender_pending', senderId: profile.smsSenderId });
  }
  return out;
}

/**
 * School settings' summary line (spec 08: "Ask Quad is on. Quiet hours are 18:00–07:00 and
 * weekends."), then what needs doing, as codes the apps turn into copy. Online payments joins the
 * sentence with M7.
 */
export function settingsSummary(
  settings: SummarySettings,
  profile: SummaryProfile,
): SettingsSummary {
  return {
    parts: [
      { code: settings.askQuadEnabled ? 'ask_quad_on' : 'ask_quad_off' },
      quietHours(settings),
    ],
    needs: needs(profile),
  };
}
