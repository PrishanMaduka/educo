import { MAX_PASSWORD_LENGTH, checkPasswordPolicy } from '@quad/domain';

import { formatMessage } from '../../common/delivery/templates/render';
import { ValidationError } from '../../common/errors';

import type { BreachCheck } from '../../common/crypto/breach-check';
import type { PasswordPolicyReason } from '@quad/domain';

function policyMessage(reason: PasswordPolicyReason, minLength: number): string {
  switch (reason) {
    case 'too_short':
      return formatMessage('error.password.tooShort', { min: minLength });
    case 'too_long':
      return formatMessage('error.password.tooLong', { max: MAX_PASSWORD_LENGTH });
  }
}

/**
 * A password being set (spec 05: a reset, or a new invitee's first one): the policy with the
 * given minimum, then the breached-password list. A refusal is 400 on `fields.password`.
 */
export async function assertNewPassword(
  password: string,
  minLength: number,
  breachCheck: BreachCheck,
): Promise<void> {
  const [reason] = checkPasswordPolicy(password, { minLength });
  if (reason !== undefined) {
    throw new ValidationError({ password: policyMessage(reason, minLength) });
  }
  if (await breachCheck.isBreached(password)) {
    throw new ValidationError({ password: formatMessage('error.password.breached') });
  }
}
