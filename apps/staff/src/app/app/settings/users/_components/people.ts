import { staffActionRefusal, type StaffAction } from '@quad/domain';

import type { StaffMember } from '@quad/contracts';

/** A row action on a member of staff (spec 08). There is no "Sign in as" for schools. */
export type RowAction = StaffAction | 'sign_out_everywhere' | 'deactivate' | 'reactivate';

/** Actions that email the member, so need an address. */
const EMAILING: ReadonlySet<RowAction> = new Set([
  'remind_two_step',
  'reset_password',
  'resend_invite',
]);

/**
 * The row actions that apply to a member, in menu order. Whether Remind, Reset password and
 * Resend invite apply is `staffActionRefusal` (`@quad/domain`), the same rule the API checks; your
 * own row has none, since nobody deactivates themselves or changes their own access here.
 */
export function rowActionsFor(member: StaffMember): RowAction[] {
  if (member.you) return [];
  const candidates: RowAction[] = [
    'remind_two_step',
    'resend_invite',
    'reset_password',
    'sign_out_everywhere',
    'deactivate',
    'reactivate',
  ];
  return candidates.filter((action) => {
    if (EMAILING.has(action) && member.email === null) return false;
    switch (action) {
      case 'remind_two_step':
      case 'reset_password':
      case 'resend_invite':
        return staffActionRefusal(action, member) === null;
      case 'sign_out_everywhere':
        return member.status === 'active';
      case 'deactivate':
        return member.status !== 'deactivated';
      case 'reactivate':
        return member.status === 'deactivated';
    }
  });
}

/** The addresses typed into the invite drawer: split on commas, semicolons and white space. */
export function splitEmails(raw: string): string[] {
  return raw.split(/[\s,;]+/).filter((part) => part !== '');
}
