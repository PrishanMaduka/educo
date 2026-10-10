import { demoRequestConfirmationEmail } from './demo-request-confirmation';
import { demoRequestSalesEmail } from './demo-request-sales';
import { emailOtpEmail } from './email-otp';
import { lockoutEmail } from './lockout';
import { newDeviceEmail } from './new-device';
import { passwordResetEmail } from './password-reset';
import { otpSms } from './sms-otp';
import { staffInviteEmail } from './staff-invite';
import { twoStepReminderEmail } from './two-step-reminder';

import type { EmailTemplate, RenderOptions, RenderedEmail } from './email-template';
import type { z } from 'zod';

export type { EmailSender, RenderOptions, RenderedEmail } from './email-template';
export type { RenderedSms } from './sms-otp';

/**
 * Every email Quad sends, by template id (the job name in the `send-email` queue): M1's, and the
 * demo request's two (M1b, D57).
 */
export const EMAIL_TEMPLATE_IDS = [
  'staff_invite',
  'password_reset',
  'lockout',
  'two_step_reminder',
  'new_device',
  'email_otp',
  'demo_request_sales',
  'demo_request_confirmation',
] as const;
export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export const EMAIL_TEMPLATES = {
  staff_invite: staffInviteEmail,
  password_reset: passwordResetEmail,
  lockout: lockoutEmail,
  two_step_reminder: twoStepReminderEmail,
  new_device: newDeviceEmail,
  email_otp: emailOtpEmail,
  demo_request_sales: demoRequestSalesEmail,
  demo_request_confirmation: demoRequestConfirmationEmail,
} as const satisfies Record<EmailTemplateId, EmailTemplate>;
/** The parameters a caller passes for template `T`. */
export type EmailParams<T extends EmailTemplateId> = z.input<(typeof EMAIL_TEMPLATES)[T]['params']>;

/** Every SMS Quad sends in M1, by template id. */
export const SMS_TEMPLATE_IDS = ['otp'] as const;
export type SmsTemplateId = (typeof SMS_TEMPLATE_IDS)[number];

export const SMS_TEMPLATES = { otp: otpSms } as const satisfies Record<SmsTemplateId, unknown>;
export type SmsParams<T extends SmsTemplateId> = z.input<(typeof SMS_TEMPLATES)[T]['params']>;

/** Renders email `id` with `params` (checked against the template first). */
export function renderEmail(
  id: EmailTemplateId,
  params: unknown,
  options: RenderOptions,
): RenderedEmail {
  return EMAIL_TEMPLATES[id].render(params, options);
}

/** Renders SMS `id` with `params` (checked against the template first) to its text. */
export function renderSms(id: SmsTemplateId, params: unknown): string {
  return SMS_TEMPLATES[id].render(params).text;
}
