import type { StaffRow } from './users.repository';
import type { StaffMember } from '@quad/contracts';

/**
 * A staff row as the API sends it, with its two-step status from `member_two_step_status`, and
 * `you` when it is the signed-in member's own row (`viewerUserId`; null in a support visit).
 */
export function toStaffMember(
  row: StaffRow,
  twoStepOn: boolean,
  viewerUserId: string | null,
): StaffMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
    role:
      row.roleId === null || row.roleName === null ? null : { id: row.roleId, name: row.roleName },
    twoStepOn,
    lastSignInAt: row.lastSignInAt?.toISOString() ?? null,
    inviteSentAt: row.inviteSentAt?.toISOString() ?? null,
    you: viewerUserId !== null && viewerUserId === row.id,
  };
}
