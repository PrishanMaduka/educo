import type { MessageKey } from '@/i18n';
import type { SettingsSummaryPart } from '@quad/contracts';

type Translate = (key: MessageKey, values?: Record<string, string>) => string;

function partText(part: SettingsSummaryPart, t: Translate): string {
  switch (part.code) {
    case 'ask_quad_on':
      return t('schoolSettings.summary.askQuadOn');
    case 'ask_quad_off':
      return t('schoolSettings.summary.askQuadOff');
    case 'quiet_hours':
      return t('schoolSettings.summary.quietHours', {
        from: part.from,
        until: part.until,
        weekends: part.weekends ? 'yes' : 'no',
      });
    case 'quiet_hours_off':
      return t('schoolSettings.summary.quietHoursOff');
  }
}

/** The page's summary line ("Ask Quad is on. Quiet hours are 18:00–07:00 and weekends."). */
export function summarySentence(parts: readonly SettingsSummaryPart[], t: Translate): string {
  return parts.map((part) => partText(part, t)).join(' ');
}
