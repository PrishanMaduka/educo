import { z } from 'zod';

import { HexColor } from '../common/color';
import { IdSchema } from '../common/ids';
import { PageQuerySchema, paginated } from '../common/pagination';
import { TenantStatus } from '../enums';

/**
 * Support access, "Open as school admin" (spec 05 → Support access; spec 06 → Platform; spec 07).
 * A Quad staff member with the `support`, `admin` or `owner` role gives a reason and gets a
 * single-use link (purpose `support_session`, 2 minutes) into the staff portal; the visit lasts
 * at most 60 minutes.
 */

/** The reason is always required and logged (spec 05, D22). */
export const SUPPORT_REASON_MIN = 10;
export const SUPPORT_REASON_MAX = 500;

/**
 * Any control character but the line feed (Unicode `Cc`: C0, DEL and C1), and any invisible
 * format character (`Cf`: bidi overrides and isolates such as U+202E, zero-width spaces, the byte
 * order mark, soft hyphens) but the zero-width joiner and non-joiner, which Sinhala and Tamil
 * spelling needs. The reason is shown in the console and written to `platform_audit`, so it
 * keeps line breaks and nothing else unseen, and cannot display reordered text.
 */
const HIDDEN_CHARACTER = /[^\P{Cc}\n]|[^\P{Cf}\u200c\u200d]/u;

/** `:id` of `/platform/tenants/:id/…`: a school's id. */
export const TenantIdParams = z.object({ id: IdSchema });
export type TenantIdParams = z.infer<typeof TenantIdParams>;

/** `POST /platform/tenants/:id/support-session`. Nothing but the reason is taken. */
export const SupportSessionCreateInput = z
  .object({
    reason: z
      .string({ required_error: 'Say why you are opening this school.' })
      .trim()
      .min(SUPPORT_REASON_MIN, {
        message: `Say why you are opening this school, in at least ${SUPPORT_REASON_MIN} characters.`,
      })
      .max(SUPPORT_REASON_MAX, {
        message: `Keep the reason to ${SUPPORT_REASON_MAX} characters or fewer.`,
      })
      .refine((reason) => !HIDDEN_CHARACTER.test(reason), {
        message: 'Write the reason as plain text; line breaks are fine.',
      }),
  })
  .strict();
export type SupportSessionCreateInput = z.infer<typeof SupportSessionCreateInput>;

/** The single-use link that opens the staff portal as the school's admin. */
export const SupportSessionLink = z.object({ url: z.string().url() });
export type SupportSessionLink = z.infer<typeof SupportSessionLink>;

/**
 * `POST /auth/support-session` (staff portal, `/sign-in/support/{token}`): the link's token, in
 * the body so request logs never carry it.
 */
export const SupportSessionRedeemInput = z.object({ token: z.string().min(1).max(2048) }).strict();
export type SupportSessionRedeemInput = z.infer<typeof SupportSessionRedeemInput>;

/** `POST /auth/support-session/end` ("Exit to platform"): where the browser goes next. */
export const SupportSessionExit = z.object({ redirect: z.string().url() });
export type SupportSessionExit = z.infer<typeof SupportSessionExit>;

/**
 * `GET /platform/tenants`: a school in the console's list (minimal in M1; M2 adds plan, seats,
 * health and the rest).
 */
export const PlatformTenant = z.object({
  id: IdSchema,
  name: z.string(),
  shortName: z.string(),
  status: TenantStatus,
  /** The school's brand colour, or null when it has none. */
  brandColor: HexColor.nullable(),
});
export type PlatformTenant = z.infer<typeof PlatformTenant>;

export const PlatformTenantList = paginated(PlatformTenant);
export type PlatformTenantList = z.infer<typeof PlatformTenantList>;

/** `GET /platform/tenants?cursor=&limit=`: every school but deleted ones, by name. */
export const PlatformTenantListQuery = PageQuerySchema;
export type PlatformTenantListQuery = z.infer<typeof PlatformTenantListQuery>;
