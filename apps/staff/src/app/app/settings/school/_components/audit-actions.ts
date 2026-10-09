import { AuditAction } from '@quad/contracts';

/** How the action filter groups the school's audit actions. */
export type AuditActionGroup = 'signIn' | 'staff' | 'roles' | 'school';

const GROUP_BY_AREA: Readonly<Record<string, AuditActionGroup>> = {
  auth: 'signIn',
  user: 'staff',
  role: 'roles',
  role_preview: 'roles',
};

/** The group an action key belongs to, from its area (`user.invited` is Staff). */
export function groupOf(action: AuditAction): AuditActionGroup {
  return GROUP_BY_AREA[action.split('.')[0] ?? ''] ?? 'school';
}

/** Every action the school's log records, in contract order. */
export const AUDIT_ACTIONS: readonly AuditAction[] = AuditAction.options;

/** The action key the filter chose, if it is one the log records. */
export function auditActionOf(value: string): AuditAction | null {
  return AUDIT_ACTIONS.find((action) => action === value) ?? null;
}
