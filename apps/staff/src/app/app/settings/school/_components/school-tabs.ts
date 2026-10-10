/** The School settings tabs in M1 (spec 08; the others join with their milestones, OQ19). */
export const SCHOOL_SETTINGS_TABS = ['general', 'sign-in', 'audit'] as const;
export type SchoolSettingsTab = (typeof SCHOOL_SETTINGS_TABS)[number];

/** Where this page lives, and the address of one tab of it. */
export const SCHOOL_SETTINGS_PATH = '/app/settings/school';

export function schoolSettingsHref(tab: SchoolSettingsTab): string {
  return tab === 'general' ? SCHOOL_SETTINGS_PATH : `${SCHOOL_SETTINGS_PATH}?tab=${tab}`;
}
