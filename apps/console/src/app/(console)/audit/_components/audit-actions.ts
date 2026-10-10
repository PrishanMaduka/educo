import { PlatformAuditLogAction } from '@quad/contracts';

/** How the console's action filter groups what `platform_audit` records. */
export type PlatformAuditActionGroup = 'console' | 'signIn' | 'support' | 'school';

const GROUP_BY_AREA: Readonly<Record<string, PlatformAuditActionGroup>> = {
  auth: 'signIn',
  support_session: 'support',
  tenant: 'console',
  audit: 'console',
};

/**
 * The group an action key belongs to, from its area: sign-in, support visits, the console's own
 * changes, and what a support visit did inside a school (copied there by the dual audit).
 */
export function platformGroupOf(action: PlatformAuditLogAction): PlatformAuditActionGroup {
  return GROUP_BY_AREA[action.split('.')[0] ?? ''] ?? 'school';
}

/** Every action the console's log records, in contract order. */
export const PLATFORM_AUDIT_ACTIONS: readonly PlatformAuditLogAction[] =
  PlatformAuditLogAction.options;

/** The action key the filter chose, if it is one the log records. */
export function platformAuditActionOf(value: string): PlatformAuditLogAction | null {
  return PLATFORM_AUDIT_ACTIONS.find((action) => action === value) ?? null;
}
