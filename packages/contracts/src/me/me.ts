import { z } from 'zod';

import { HexColor } from '../common/color';
import { IdSchema } from '../common/ids';
import { paginated } from '../common/pagination';
import { IsoDateTimeSchema } from '../common/time';
import { ThemeChoice } from '../enums';

import { Greeting } from './greeting';

/**
 * The school's brand tokens for one theme, computed by the API with `deriveBrand` from
 * `@quad/tokens` (spec 03 "School brand colour"; D34, D56): the fill and hover fill that carry
 * `ink` text at 4.5:1, the brand as text, the tint, and the active side-bar item with its ink.
 */
export const MeBrandTheme = z.object({
  fill: HexColor,
  fillStrong: HexColor,
  ink: HexColor,
  text: HexColor,
  soft: HexColor,
  railActive: HexColor,
  railActiveInk: HexColor,
});
export type MeBrandTheme = z.infer<typeof MeBrandTheme>;

/**
 * The school's brand: `color` is the colour it stands for (`brand-raw`; Quad lime when the school
 * has none), and `light` and `dark` are the derived tokens for each theme. The apps apply these
 * values as they are and never derive them (D56).
 */
export const MeBrand = z.object({
  color: HexColor,
  light: MeBrandTheme,
  dark: MeBrandTheme,
});
export type MeBrand = z.infer<typeof MeBrand>;

/** The signed-in person in this school (their membership; in a support visit, the Quad staff member). */
export const MePerson = z.object({
  name: z.string(),
  firstName: z.string(),
  theme: ThemeChoice,
  /** BCP 47: the person's own locale, or the school's when they have not chosen one. */
  locale: z.string(),
  /** Their roles in this school, primary first; empty in a support visit (no membership). */
  roleNames: z.array(z.string()),
});
export type MePerson = z.infer<typeof MePerson>;

/** The school the session is in. Year-group labels and the rest arrive with their features. */
export const MeSchool = z.object({
  id: IdSchema,
  name: z.string(),
  shortName: z.string(),
  timeZone: z.string(),
  brand: MeBrand,
});
export type MeSchool = z.infer<typeof MeSchool>;

/** Another school the person can switch to (profile menu → Switch school, spec 05). */
export const MeMembership = z.object({
  tenantId: IdSchema,
  name: z.string(),
  shortName: z.string(),
  brandColor: HexColor.nullable(),
  /** Primary role first. */
  roleNames: z.array(z.string()),
  /** A suspended school is listed but cannot be opened (spec 05, 07). */
  suspended: z.boolean(),
});
export type MeMembership = z.infer<typeof MeMembership>;

/** The Preview a role banner (spec 08): the role being previewed and the sample person, if any. */
export const MePreview = z.object({
  roleId: IdSchema,
  roleName: z.string(),
  sampleUser: z.object({ id: IdSchema, name: z.string() }).nullable(),
});
export type MePreview = z.infer<typeof MePreview>;

/** The support view banner (spec 05, Support access): "you're in {school} as {name} from Quad". */
export const MeSupport = z.object({
  schoolName: z.string(),
  platformUserName: z.string(),
});
export type MeSupport = z.infer<typeof MeSupport>;

/** `GET /me`: who is signed in, where, and what the shell shows around them. */
export const Me = z.object({
  person: MePerson,
  school: MeSchool,
  /** The person's other active staff memberships; empty in a support visit. */
  memberships: z.array(MeMembership),
  preview: MePreview.nullable(),
  support: MeSupport.nullable(),
  /** In the school's time zone (D27 M1 follow-up: the API returns the greeting). */
  greeting: Greeting,
});
export type Me = z.infer<typeof Me>;

function isLanguageTag(value: string): boolean {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}

/** A BCP 47 language tag such as `en-LK`. */
export const LocaleTag = z
  .string()
  .max(35)
  .refine(isLanguageTag, { message: 'must be a language tag such as en-LK' });

/** `PATCH /me`: the person's own name, theme and locale in this school (null locale = the school's). */
export const MeUpdateInput = z
  .object({
    name: z.string().trim().min(1, { message: 'Enter your name' }).max(120).optional(),
    theme: ThemeChoice.optional(),
    locale: LocaleTag.nullable().optional(),
  })
  .refine((input) => 'name' in input || 'theme' in input || 'locale' in input, {
    message: 'Change at least one of name, theme and locale',
  });
export type MeUpdateInput = z.infer<typeof MeUpdateInput>;

/** One of the person's signed-in devices (`GET /me/sessions`). Console sessions are never listed. */
export const SessionSummary = z.object({
  id: IdSchema,
  kind: z.enum(['web', 'mobile']),
  deviceName: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  lastSeenAt: IsoDateTimeSchema,
  /** The session this request was made with. */
  current: z.boolean(),
});
export type SessionSummary = z.infer<typeof SessionSummary>;

export const SessionSummaryList = paginated(SessionSummary);
export type SessionSummaryList = z.infer<typeof SessionSummaryList>;

/** `DELETE /me/sessions/:id`. */
export const SessionIdParams = z.object({ id: IdSchema });
export type SessionIdParams = z.infer<typeof SessionIdParams>;
