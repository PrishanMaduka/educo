import { z } from 'zod';

import { IdSchema } from '../common/ids';
import { PageQuerySchema, paginated } from '../common/pagination';
import { IsoDateTimeSchema } from '../common/time';

import { AuditAction, PlatformAuditAction } from './actions';

/**
 * The read side of the audit logs (spec 05 → Audit): Settings → Audit for a school (spec 08,
 * `GET /audit`) and the console's Audit log (spec 07, `GET /platform/audit`). Both filter by who,
 * what and when, page newest first, and answer `Accept: text/csv` with the filtered rows.
 */

/**
 * Compares two UTC instants (`…Z`, any number of fractional digits) as instants, to the
 * microsecond and beyond: whole seconds by `Date.parse`, then the fraction digit by digit. Text
 * order is wrong for these ('…00Z' sorts after '…00.5Z'), and `Date.parse` alone drops
 * microseconds, which the server compares (Task 15 review M1).
 */
function compareInstants(a: string, b: string): number {
  const [aSeconds, aFraction] = splitInstant(a);
  const [bSeconds, bFraction] = splitInstant(b);
  if (aSeconds !== bSeconds) return aSeconds < bSeconds ? -1 : 1;
  const width = Math.max(aFraction.length, bFraction.length);
  const left = aFraction.padEnd(width, '0');
  const right = bFraction.padEnd(width, '0');
  return left === right ? 0 : left < right ? -1 : 1;
}

/** Whole seconds since the epoch, and the fraction's digits ('' when there are none). */
function splitInstant(iso: string): readonly [number, string] {
  const dot = iso.indexOf('.');
  const whole = dot === -1 ? iso.slice(0, -1) : iso.slice(0, dot);
  const fraction = dot === -1 ? '' : iso.slice(dot + 1, -1);
  return [Date.parse(`${whole}Z`), fraction];
}

/** `from` must come before `to` when both are given. */
const rangeInOrder = (range: { from?: string; to?: string }) =>
  range.from === undefined || range.to === undefined || compareInstants(range.from, range.to) < 0;

const RANGE_MESSAGE = { message: 'Choose an end after the start', path: ['to'] };

/**
 * `GET /audit?actor=&action=&from=&to=&cursor=&limit=`. `actor` is a member's id (`users.id`);
 * `from` (inclusive) and `to` (exclusive) are UTC instants, which the staff portal works out from
 * the school's own dates.
 */
export const AuditLogQuery = PageQuerySchema.extend({
  actor: IdSchema.optional(),
  action: AuditAction.optional(),
  from: IsoDateTimeSchema.optional(),
  to: IsoDateTimeSchema.optional(),
}).refine(rangeInOrder, RANGE_MESSAGE);
export type AuditLogQuery = z.infer<typeof AuditLogQuery>;

/** What an entry is about: a record's type and id (null when it has no single record). */
export const AuditTargetRef = z.object({
  type: z.string(),
  id: IdSchema.nullable(),
});
export type AuditTargetRef = z.infer<typeof AuditTargetRef>;

/**
 * Who did it, in a school's log: a member (with their name), Quad support in a support visit
 * (spec 08: "Support sessions from Quad are marked"; the school is not told which Quad staff
 * member), or the system (no person, for example a scheduled job).
 */
export const AuditActor = z.discriminatedUnion('type', [
  z.object({ type: z.literal('member'), id: IdSchema, name: z.string() }),
  z.object({ type: z.literal('quad_support') }),
  z.object({ type: z.literal('system') }),
]);
export type AuditActor = z.infer<typeof AuditActor>;

/** A JSON value from an entry's `meta` (ids, codes, before and after values; never secrets). */
export const AuditMetaJson = z.record(z.string(), z.unknown());
export type AuditMetaJson = z.infer<typeof AuditMetaJson>;

/**
 * One entry of a school's log, newest first. `summary` is the readable line ("Invited Nadeesha
 * Jayasinghe"); `meta` is the detail the row's drawer lays out. `viaSupport` marks what Quad did
 * in a support visit.
 */
export const AuditEntry = z.object({
  id: IdSchema,
  at: IsoDateTimeSchema,
  action: z.string(),
  summary: z.string(),
  actor: AuditActor,
  viaSupport: z.boolean(),
  target: AuditTargetRef.nullable(),
  meta: AuditMetaJson,
  ip: z.string().nullable(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const AuditLog = paginated(AuditEntry);
export type AuditLog = z.infer<typeof AuditLog>;

/** A member of the school who appears in its log, for the person filter. */
export const AuditPerson = z.object({ id: IdSchema, name: z.string() });
export type AuditPerson = z.infer<typeof AuditPerson>;

/**
 * `GET /audit/people`: the school's members who did something in its log, by name. The person
 * filter needs it because `settings.view` (a principal) cannot list staff (`users.manage`).
 */
export const AuditPeople = z.object({ items: z.array(AuditPerson) });
export type AuditPeople = z.infer<typeof AuditPeople>;

/**
 * Every key `platform_audit.action` holds: the console's own actions, and the school actions
 * a support visit copies there (dual audit, `record_support_audit`).
 */
export const PlatformAuditLogAction = z.enum([
  ...new Set([...PlatformAuditAction.options, ...AuditAction.options]),
] as [PlatformAuditAction | AuditAction, ...(PlatformAuditAction | AuditAction)[]]);
export type PlatformAuditLogAction = z.infer<typeof PlatformAuditLogAction>;

/**
 * `GET /platform/audit?actor=&tenantId=&action=&from=&to=&cursor=&limit=`. `actor` is a Quad
 * staff member's id (`platform_users.id`); `tenantId` picks one school (a console filter, never a
 * school's own tenant).
 */
export const PlatformAuditLogQuery = PageQuerySchema.extend({
  actor: IdSchema.optional(),
  tenantId: IdSchema.optional(),
  action: PlatformAuditLogAction.optional(),
  from: IsoDateTimeSchema.optional(),
  to: IsoDateTimeSchema.optional(),
}).refine(rangeInOrder, RANGE_MESSAGE);
export type PlatformAuditLogQuery = z.infer<typeof PlatformAuditLogQuery>;

/** Who did it, in the console's log: a Quad staff member, or the system. */
export const PlatformAuditActor = z.discriminatedUnion('type', [
  z.object({ type: z.literal('quad'), id: IdSchema, name: z.string() }),
  z.object({ type: z.literal('system') }),
]);
export type PlatformAuditActor = z.infer<typeof PlatformAuditActor>;

/** One entry of the console's log: the school it was about, if any, and the support marker. */
export const PlatformAuditEntry = z.object({
  id: IdSchema,
  at: IsoDateTimeSchema,
  action: z.string(),
  summary: z.string(),
  actor: PlatformAuditActor,
  school: z.object({ id: IdSchema, name: z.string() }).nullable(),
  viaSupport: z.boolean(),
  target: AuditTargetRef.nullable(),
  meta: AuditMetaJson,
  ip: z.string().nullable(),
});
export type PlatformAuditEntry = z.infer<typeof PlatformAuditEntry>;

export const PlatformAuditLog = paginated(PlatformAuditEntry);
export type PlatformAuditLog = z.infer<typeof PlatformAuditLog>;
