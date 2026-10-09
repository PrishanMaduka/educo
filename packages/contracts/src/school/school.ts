import { z } from 'zod';

import { SignInEmail } from '../auth/sign-in';
import { HexColor } from '../common/color';
import { IsoDateTimeSchema } from '../common/time';
import {
  AbsenceAlertMode,
  EarlyWarningSharing,
  PhotoConsent,
  SmsSenderStatus,
  TwoStepRule,
} from '../enums';

/**
 * Settings → School settings (spec 06 School settings and people; spec 08 School settings): the
 * General tab (`GET/PATCH /school`), the school's logo and colour (`GET /school/branding`), and
 * the other tabs' values, read-only in M1 (`GET /settings`; each tab's `PATCH` comes with its
 * feature, OQ19).
 */

/** A school-local time of day, `HH:mm` (spec 06 Conventions). */
export const LocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  message: 'must be a time such as 18:00',
});
export type LocalTime = z.infer<typeof LocalTime>;

/**
 * A school's own SMS sender ID (spec 08 General; spec 20: registered with the carriers through
 * the SMS provider). Spec 06 and 08 set no format, so D32 does: the alphanumeric sender ID most
 * carriers accept, 3 to 11 letters and digits with at least one letter (all digits reads as a
 * phone number), and no spaces or symbols.
 */
export const SmsSenderId = z
  .string()
  .trim()
  .regex(/^(?=.*[A-Za-z])[A-Za-z0-9]{3,11}$/, {
    message: 'Use 3 to 11 letters and numbers, with at least one letter',
  });
export type SmsSenderId = z.infer<typeof SmsSenderId>;

/** One part of the summary sentence ("Ask Quad is on. Quiet hours are 18:00–07:00 and weekends."). */
export const SettingsSummaryPart = z.discriminatedUnion('code', [
  z.object({ code: z.literal('ask_quad_on') }),
  z.object({ code: z.literal('ask_quad_off') }),
  z.object({
    code: z.literal('quiet_hours'),
    from: LocalTime,
    until: LocalTime,
    weekends: z.boolean(),
  }),
  z.object({ code: z.literal('quiet_hours_off') }),
]);
export type SettingsSummaryPart = z.infer<typeof SettingsSummaryPart>;

/** Something the school should do next, shown after the summary sentence. */
export const SettingsSummaryNeed = z.discriminatedUnion('code', [
  /** No office email: the school's emails go out without a Reply-To. */
  z.object({ code: z.literal('add_office_email') }),
  /** The school's own sender ID waits for approval; texts go as "QUAD" meanwhile. */
  z.object({ code: z.literal('sms_sender_pending'), senderId: z.string() }),
]);
export type SettingsSummaryNeed = z.infer<typeof SettingsSummaryNeed>;

/**
 * The story-first summary of School settings, as codes the apps turn into copy (computed by
 * `settingsSummary` in `@quad/domain`). Online payments joins it with M7.
 */
export const SettingsSummary = z.object({
  parts: z.array(SettingsSummaryPart),
  needs: z.array(SettingsSummaryNeed),
});
export type SettingsSummary = z.infer<typeof SettingsSummary>;

/** The school's logo and colour, set in the console ("Set by Quad"). */
export const SchoolBranding = z.object({
  /** The colour the school's pages use: its own, or Quad's default when it has none. */
  color: HexColor,
  /** Null until school logos are stored as files (M4). */
  logoUrl: z.string().url().nullable(),
});
export type SchoolBranding = z.infer<typeof SchoolBranding>;

/**
 * The school's sign-in rules (spec 05), shown read-only with "Managed by Quad. Ask support to
 * change them." (spec 08). There is no single sign-on to set up (D37).
 */
export const SchoolSignInRules = z.object({
  twoStep: TwoStepRule,
  passwordMinLength: z.number().int().min(10),
  sessionHours: z.number().int().positive(),
  ipAllowlist: z.array(z.string()),
});
export type SchoolSignInRules = z.infer<typeof SchoolSignInRules>;

/** `GET /school` and `PATCH /school`: the General tab. */
export const School = z.object({
  name: z.string(),
  shortName: z.string(),
  /** Reply-To on the school's emails. */
  officeEmail: z.string().nullable(),
  /** E.164. */
  officePhone: z.string().nullable(),
  address: z.string().nullable(),
  /** Read-only: set in the console. */
  timeZone: z.string(),
  smsSenderId: z.string().nullable(),
  /** Null when the school has not asked for its own sender ID. */
  smsSenderStatus: SmsSenderStatus.nullable(),
  /** Read-only: "Set by Quad". */
  branding: SchoolBranding,
  /** Read-only: "Managed by Quad". */
  signIn: SchoolSignInRules,
  summary: SettingsSummary,
  /**
   * The version to send back as `If-Match` with a change (also the `ETag` header). Clients send
   * this body value, never the header: a proxy may weaken the header to `W/"…"`, which the strong
   * comparison refuses (D32).
   */
  etag: z
    .string()
    .describe(
      'The version to send back as If-Match with a change. Send this value from the body, not the ETag header: a proxy may weaken the header (W/), and a weak tag is refused.',
    ),
});
export type School = z.infer<typeof School>;

/**
 * Fields the General tab shows but Quad manages (spec 08; 08 wins over 06, OQ19): `PATCH /school`
 * refuses each with 400 rather than ignoring it, so a client never believes it saved one.
 */
export const MANAGED_BY_QUAD_FIELDS = [
  'shortName',
  'timeZone',
  'branding',
  'brandColor',
  'color',
  'logo',
  'logoUrl',
  'signIn',
  'twoStep',
  'passwordMinLength',
  'sessionHours',
  'ipAllowlist',
] as const;

const MANAGED: ReadonlySet<string> = new Set(MANAGED_BY_QUAD_FIELDS);

/** Names unknown keys: Quad's own fields say so, anything else cannot be changed here. */
const updateErrors: z.ZodErrorMap = (issue, context) => {
  if (issue.code !== z.ZodIssueCode.unrecognized_keys) return { message: context.defaultError };
  const keys = issue.keys.join(', ');
  return issue.keys.every((key) => MANAGED.has(key))
    ? { message: `${keys}: managed by Quad. Ask support to change it.` }
    : { message: `${keys} can’t be changed here.` };
};

const Address = z.string().trim().min(1, { message: 'Enter the address' }).max(500, {
  message: 'Use at most 500 characters',
});

/**
 * `PATCH /school` (needs `If-Match`): any of the General tab's own fields. The office phone is
 * checked against the school's country by the API (D35); null clears an optional field.
 */
export const SchoolUpdateInput = z
  .object(
    {
      name: z
        .string()
        .trim()
        .min(1, { message: 'Enter the school’s name' })
        .max(120, { message: 'Use at most 120 characters' }),
      officeEmail: SignInEmail.nullable(),
      officePhone: z
        .string()
        .trim()
        .min(1, { message: 'Enter the office phone number' })
        .max(32, { message: 'Enter a shorter phone number' })
        .nullable(),
      address: Address.nullable(),
      smsSenderId: SmsSenderId.nullable(),
    },
    { errorMap: updateErrors },
  )
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, { message: 'Change at least one thing' });
export type SchoolUpdateInput = z.infer<typeof SchoolUpdateInput>;

/**
 * `If-Match` on `PATCH /school`: the body's `etag` from the last read, sent as it is. Not the
 * `ETag` response header, which a proxy may have weakened (D32).
 */
export const IfMatchHeaders = z.object({
  'if-match': z
    .string()
    .min(1)
    .max(200)
    .describe(
      'The `etag` value from the last response body, sent as it is. Do not copy the ETag header: a proxy may weaken it (W/), and a weak tag is refused with 409.',
    ),
});
export type IfMatchHeaders = z.infer<typeof IfMatchHeaders>;

/**
 * `GET /settings`: the school's `school_settings` values outside General, read-only in M1 (spec
 * 08 tabs Families, Communication, Early warning and Ask Quad; each tab's `PATCH` comes with its
 * feature, OQ19). Times are school-local `HH:mm`.
 */
export const SchoolSettings = z.object({
  askQuadEnabled: z.boolean(),
  askQuadKeepConversations: z.boolean(),
  ewShareWithParents: EarlyWarningSharing,
  absenceAlert: AbsenceAlertMode,
  absenceAlertTime: LocalTime,
  /** Days relative to the due date: negative is before. */
  reminderDays: z.array(z.number().int()),
  photoConsentDefault: PhotoConsent,
  familyCircleEnabled: z.boolean(),
  quietHoursEnabled: z.boolean(),
  quietFrom: LocalTime,
  quietUntil: LocalTime,
  quietWeekends: z.boolean(),
  updatedAt: IsoDateTimeSchema,
});
export type SchoolSettings = z.infer<typeof SchoolSettings>;
