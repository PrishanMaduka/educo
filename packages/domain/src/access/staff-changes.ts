import type { MembershipStatus } from '@quad/contracts';

/** A role or status change to a member of staff on `PATCH /users/:id` (spec 08, Users & roles). */
export interface StaffChange {
  /** Who is making the change: the member, or null in a Quad support visit. */
  readonly actorUserId: string | null;
  readonly target: {
    readonly id: string;
    readonly status: MembershipStatus;
    /** The member holds the school's system `admin` role now. */
    readonly isAdmin: boolean;
  };
  /** The member holds the system `admin` role after the change. */
  readonly nextIsAdmin: boolean;
  /** The change names a role (even the one the member already has). */
  readonly roleChanges: boolean;
  /** The status after the change (the current one when the change leaves it). */
  readonly nextStatus: MembershipStatus;
  /** Active admins of the school other than the target, counted under the admin lock. */
  readonly otherActiveAdmins: number;
}

/**
 * Why a change is refused:
 * - `self`: nobody changes their own role or deactivates themselves (they could lock themselves
 *   out; another admin does it);
 * - `last_admin`: the school always keeps one active admin, so the last one can be neither demoted
 *   nor deactivated;
 * - `status_not_allowed`: an invited member becomes active only by accepting the invitation.
 */
export type StaffChangeRefusal = 'self' | 'last_admin' | 'status_not_allowed';

const ALLOWED_STATUS_CHANGES: Readonly<Record<MembershipStatus, readonly MembershipStatus[]>> = {
  invited: ['deactivated'],
  active: ['deactivated'],
  // `invited` only through `statusAfterChange`: reactivating a never-accepted invitation.
  deactivated: ['active', 'invited'],
};

/**
 * The status a requested change stores (fix round 1, I1): reactivating a member who never
 * accepted their invitation puts the invitation back (`invited`, to be sent again), never
 * `active`. Anything else is stored as asked.
 */
export function statusAfterChange(change: {
  readonly current: MembershipStatus;
  readonly requested: MembershipStatus;
  /** The membership was accepted once (`users.accepted_at`). */
  readonly accepted: boolean;
}): MembershipStatus {
  const { current, requested, accepted } = change;
  if (current === 'deactivated' && requested === 'active' && !accepted) return 'invited';
  return requested;
}

/** Whether a role or status change may go ahead (null), or why not. */
export function staffChangeRefusal(change: StaffChange): StaffChangeRefusal | null {
  const { target, nextStatus } = change;
  const statusChanges = nextStatus !== target.status;
  if (change.actorUserId === target.id && (change.roleChanges || statusChanges)) return 'self';
  if (statusChanges && !ALLOWED_STATUS_CHANGES[target.status].includes(nextStatus)) {
    return 'status_not_allowed';
  }
  const activeAdminBefore = target.status === 'active' && target.isAdmin;
  const activeAdminAfter = nextStatus === 'active' && change.nextIsAdmin;
  if (activeAdminBefore && !activeAdminAfter && change.otherActiveAdmins === 0) {
    return 'last_admin';
  }
  return null;
}

/** The row actions on a member of staff (spec 08: Remind, Reset password; Resend invite). */
export type StaffAction = 'remind_two_step' | 'reset_password' | 'resend_invite';

/**
 * Why a row action does not apply to the member (null when it does):
 * - `two_step_on`: Remind asks for two-step sign-in, which is already on;
 * - `not_active`: Remind and Reset password are for members who can sign in (an invited member
 *   sets a password from the invitation, a deactivated one cannot sign in);
 * - `not_invited`: only a pending invitation can be sent again.
 */
export type StaffActionRefusal = 'two_step_on' | 'not_active' | 'not_invited';

export function staffActionRefusal(
  action: StaffAction,
  member: { readonly status: MembershipStatus; readonly twoStepOn: boolean },
): StaffActionRefusal | null {
  switch (action) {
    case 'remind_two_step':
      if (member.status !== 'active') return 'not_active';
      return member.twoStepOn ? 'two_step_on' : null;
    case 'reset_password':
      return member.status === 'active' ? null : 'not_active';
    case 'resend_invite':
      return member.status === 'invited' ? null : 'not_invited';
  }
}
