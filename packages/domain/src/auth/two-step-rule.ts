import type { TwoStepRule } from '@quad/contracts';

/** One staff membership's school rule and the person's role keys there (`auth_sign_in_rules`). */
export interface TwoStepRow {
  readonly twoStep: TwoStepRule;
  readonly roleKeys: readonly string[];
}

export interface TwoStepResult {
  /** The strictest rule that covers the person in any of their schools; `off` when none does. */
  readonly rule: TwoStepRule;
  /** True when that rule asks for two-step. */
  readonly required: boolean;
}

/** Strictness order (spec 04 `tenant_security.two_step`): off < admins < staff < all. */
const STRICTNESS: Readonly<Record<TwoStepRule, number>> = { off: 0, admins: 1, staff: 2, all: 3 };

/** The system role key of School admin (spec 05, School roles). */
const ADMIN_ROLE_KEY = 'admin';

/** Whether a school's rule covers this staff member there. */
function covers(row: TwoStepRow): boolean {
  switch (row.twoStep) {
    case 'off':
      return false;
    case 'admins':
      return row.roleKeys.includes(ADMIN_ROLE_KEY);
    case 'staff':
    case 'all':
      // Every row is an active staff membership, so both cover the person.
      return true;
  }
}

/**
 * The two-step rule for a person across all their schools (spec 05 step 4): one account opens
 * every school, so the strictest rule that covers their role in any school wins. `admins` covers
 * the School admin role (`admin`) only. This is the only place the rule is computed.
 */
export function strictestTwoStep(rows: readonly TwoStepRow[]): TwoStepResult {
  let rule: TwoStepRule = 'off';
  for (const row of rows) {
    if (covers(row) && STRICTNESS[row.twoStep] > STRICTNESS[rule]) rule = row.twoStep;
  }
  return { rule, required: rule !== 'off' };
}
