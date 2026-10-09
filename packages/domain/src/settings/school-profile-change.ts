import type { SmsSenderStatus } from '@quad/contracts';

/** The General tab's own values (spec 08), as stored. */
export interface SchoolProfileValues {
  readonly name: string;
  readonly officeEmail: string | null;
  readonly officePhone: string | null;
  readonly address: string | null;
  readonly smsSenderId: string | null;
  readonly smsSenderStatus: SmsSenderStatus | null;
}

/** What a school may send: every value but the sender ID's status, which Quad moves on. */
export type SchoolProfileInput = Partial<Omit<SchoolProfileValues, 'smsSenderStatus'>>;

export type SchoolProfileField = keyof SchoolProfileValues;

export type SchoolProfileChanges = Partial<
  Record<SchoolProfileField, { readonly from: string | null; readonly to: string | null }>
>;

export interface SchoolProfilePlan {
  readonly next: SchoolProfileValues;
  /** Only the fields whose value changes, for the audit (`settings.updated`). */
  readonly changes: SchoolProfileChanges;
  /** The keys of `changes`, in the order General lists them. */
  readonly fields: readonly SchoolProfileField[];
}

const FIELDS: readonly SchoolProfileField[] = [
  'name',
  'officeEmail',
  'officePhone',
  'address',
  'smsSenderId',
  'smsSenderStatus',
];

/**
 * The sender ID's status after a change (spec 08 General: "requested through Quad; QUAD until
 * approved"): a new ID is requested again, even in place of an approved one; withdrawing it
 * leaves nothing to approve; the same ID keeps its status.
 */
function senderStatusAfter(
  current: SchoolProfileValues,
  senderId: string | null,
): SmsSenderStatus | null {
  if (senderId === current.smsSenderId) return current.smsSenderStatus;
  return senderId === null ? null : 'requested';
}

/** The General tab after `input`, and what changed. */
export function planSchoolProfileChange(
  current: SchoolProfileValues,
  input: SchoolProfileInput,
): SchoolProfilePlan {
  const merged = { ...current, ...input };
  const next: SchoolProfileValues = {
    ...merged,
    smsSenderStatus: senderStatusAfter(current, merged.smsSenderId),
  };
  const fields = FIELDS.filter((field) => next[field] !== current[field]);
  const changes: SchoolProfileChanges = Object.fromEntries(
    fields.map((field) => [field, { from: current[field], to: next[field] }]),
  );
  return { next, changes, fields };
}
