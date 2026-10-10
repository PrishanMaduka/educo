import { AuditMetaJson } from '@quad/contracts';

import { formatMessage } from '../delivery/templates/render';
import { BusinessRuleError } from '../errors';

import type { AuditAction, PlatformAuditAction } from './audit-actions';
import type { MessageKey } from '../delivery/templates/render';

/**
 * The readable line of an audit entry (spec 08: "a readable detail of each entry"; spec 07), in
 * the shared catalogue's words. Every action key has its own sentence, so a new key fails to
 * compile until it has one.
 */
const SUMMARIES: Readonly<Record<AuditAction | PlatformAuditAction, MessageKey>> = {
  'auth.sign_in': 'audit.summary.signIn',
  'auth.sign_in_failed': 'audit.summary.signInFailed',
  'auth.sign_out': 'audit.summary.signOut',
  'auth.password_reset': 'audit.summary.passwordReset',
  'auth.two_step_enabled': 'audit.summary.twoStepEnabled',
  'auth.recovery_code_used': 'audit.summary.recoveryCodeUsed',
  'auth.password_accepted': 'audit.summary.passwordAccepted',
  'auth.two_step_setup_started': 'audit.summary.twoStepSetupStarted',
  'user.invited': 'audit.summary.userInvited',
  'user.invite_accepted': 'audit.summary.userInviteAccepted',
  'user.role_changed': 'audit.summary.userRoleChanged',
  'user.deactivated': 'audit.summary.userDeactivated',
  'user.reactivated': 'audit.summary.userReactivated',
  'user.two_step_reminded': 'audit.summary.userTwoStepReminded',
  'user.password_reset_sent': 'audit.summary.userPasswordResetSent',
  'user.signed_out_everywhere': 'audit.summary.userSignedOutEverywhere',
  'role.created': 'audit.summary.roleCreated',
  'role.updated': 'audit.summary.roleUpdated',
  'role.deleted': 'audit.summary.roleDeleted',
  'role.permissions_changed': 'audit.summary.rolePermissionsChanged',
  'role_preview.started': 'audit.summary.rolePreviewStarted',
  'role_preview.ended': 'audit.summary.rolePreviewEnded',
  'settings.updated': 'audit.summary.settingsUpdated',
  'support_session.started': 'audit.summary.supportSessionStarted',
  'support_session.ended': 'audit.summary.supportSessionEnded',
  'audit.exported': 'audit.summary.auditExported',
  'sensitive.accessed': 'audit.summary.sensitiveAccessed',
  'tenant.renamed': 'audit.summary.tenantRenamed',
};

/** What `{target}` reads as when the record has no name to show (deleted, or another kind). */
const TARGET_NOUNS: Readonly<Record<string, MessageKey>> = {
  user: 'audit.target.user',
  role: 'audit.target.role',
};

/** School settings field names as people read them (`settings.updated` lists them). */
const FIELD_LABELS: Readonly<Record<string, MessageKey>> = {
  name: 'audit.field.name',
  officeEmail: 'audit.field.officeEmail',
  officePhone: 'audit.field.officePhone',
  address: 'audit.field.address',
  smsSenderId: 'audit.field.smsSenderId',
  smsSenderStatus: 'audit.field.smsSenderStatus',
};

const LIST = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/** One stored entry, as much as its line needs. */
export interface SummaryInput {
  readonly action: string;
  readonly targetType: string | null;
  /** The target's current name (a member, a role), when there is one to show. */
  readonly targetName: string | null;
  readonly meta: Readonly<Record<string, unknown>>;
}

const isKnown = (action: string): action is AuditAction | PlatformAuditAction =>
  Object.hasOwn(SUMMARIES, action);

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

function targetOf(input: SummaryInput): string {
  const named = input.targetName ?? text(input.meta['name']);
  if (named !== null) {
    return input.targetType === 'role'
      ? formatMessage('audit.target.roleNamed', { name: named })
      : named;
  }
  const noun = input.targetType === null ? undefined : TARGET_NOUNS[input.targetType];
  return formatMessage(noun ?? 'audit.target.other');
}

function fieldsOf(meta: SummaryInput['meta']): string[] {
  const fields = meta['fields'];
  if (!Array.isArray(fields)) return [];
  return fields.flatMap((field) => {
    if (typeof field !== 'string') return [];
    const label = FIELD_LABELS[field];
    return [label === undefined ? field : formatMessage(label)];
  });
}

/**
 * The entry's line: "Invited Nadeesha Jayasinghe", "Changed School settings: office email and
 * address". An action this API does not know (a key a newer release wrote) shows as its key.
 */
export function auditSummary(input: SummaryInput): string {
  if (!isKnown(input.action)) return formatMessage('audit.summary.other', { action: input.action });
  const fields = fieldsOf(input.meta);
  const rows = input.meta['rows'];
  return formatMessage(SUMMARIES[input.action], {
    target: targetOf(input),
    resent: input.meta['resent'] === true ? 'yes' : 'no',
    fields: LIST.format(fields),
    count: fields.length,
    rows: typeof rows === 'number' ? rows : 0,
    key: text(input.meta['key']) ?? 'other',
    from: text(input.meta['from']) ?? '',
    to: text(input.meta['to']) ?? '',
  });
}

/** How a person who acted reads in an export: their name, Quad support, or the system. */
export const QUAD_SUPPORT = (): string => formatMessage('audit.actor.quadSupport');
export const SYSTEM_ACTOR = (): string => formatMessage('audit.actor.system');

/** Yes or No, for an export's support visit column. */
export const yesNo = (value: boolean): string =>
  formatMessage(value ? 'audit.csv.yes' : 'audit.csv.no');

/** An entry's `meta` as stored: a JSON object (the column defaults to `{}`). */
export function metaOf(meta: unknown): AuditMetaJson {
  const parsed = AuditMetaJson.safeParse(meta);
  return parsed.success ? parsed.data : {};
}

/** The most entries one export of an audit log holds; more asks for a shorter range (D32). */
export const AUDIT_EXPORT_MAX_ROWS = 10_000;

/** 422 for an export of more than `AUDIT_EXPORT_MAX_ROWS` entries. */
export function tooManyToExport(): BusinessRuleError {
  return new BusinessRuleError(
    'business_rule',
    formatMessage('error.audit.exportTooLarge', {
      max: AUDIT_EXPORT_MAX_ROWS.toLocaleString('en'),
    }),
  );
}
