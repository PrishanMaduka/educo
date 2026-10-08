/** Spec 05: passwords have at least 10 characters; a school may ask for more, never less. */
export const MIN_PASSWORD_LENGTH = 10;
/** An upper bound so a password stays a password (D32); NIST 800-63B asks for at least 64. */
export const MAX_PASSWORD_LENGTH = 128;

/** Why a password is refused. The breached-password check is the API's (it needs the network). */
export type PasswordPolicyReason = 'too_short' | 'too_long';

export interface PasswordPolicy {
  /** The school's minimum (`tenant_security.password_min_length`); the floor still applies. */
  readonly minLength: number;
}

/** NIST 800-63B counts each Unicode code point as one character. */
function codePoints(text: string): number {
  return Array.from(text).length;
}

/**
 * The reasons `password` breaks the policy, empty when it is fine. Length counts characters
 * (Unicode code points), not UTF-16 code units, and spaces count.
 */
export function checkPasswordPolicy(
  password: string,
  policy: PasswordPolicy,
): PasswordPolicyReason[] {
  const length = codePoints(password);
  const reasons: PasswordPolicyReason[] = [];
  if (length < Math.max(MIN_PASSWORD_LENGTH, policy.minLength)) {
    reasons.push('too_short');
  }
  if (length > MAX_PASSWORD_LENGTH) {
    reasons.push('too_long');
  }
  return reasons;
}
