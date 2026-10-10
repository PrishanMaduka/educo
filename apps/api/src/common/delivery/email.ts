import { z } from 'zod';

import { EMAIL_TEMPLATES, EMAIL_TEMPLATE_IDS } from './templates';
import { formatMessage } from './templates/render';

import type { Config } from '../../config';

/** One email, ready for a provider. */
export interface EmailMessage {
  readonly to: string;
  readonly from: { readonly name: string; readonly address: string };
  readonly replyTo: string | null;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** An email provider (SMTP or SES) behind one interface (D19). */
export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

/** The school that sends school mail: its name for From, its office email for Reply-To. */
export const SchoolSenderSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    replyTo: z.string().email().nullable(),
  })
  .strict();
export type SchoolSender = z.infer<typeof SchoolSenderSchema>;

/**
 * A `send-email` job. The template's own parameters are checked when it renders. `tenantId` is
 * the school of the request that queued it (null for account mail sent outside a school); the
 * worker runs the job in that tenant's context.
 */
export const EmailJobSchema = z
  .object({
    to: z.string().email().max(320),
    tenantId: z.string().uuid().nullable(),
    school: SchoolSenderSchema.nullable(),
    template: z.enum(EMAIL_TEMPLATE_IDS),
    params: z.record(z.unknown()),
  })
  .strict();
export type EmailJob = z.infer<typeof EmailJobSchema>;

/** Settings every email needs, from the config. */
export interface EmailSettings {
  /** `EMAIL_FROM_DOMAIN`: mail comes from `no-reply@` this domain. */
  readonly fromDomain: string;
  readonly publicWebUrl: string;
  /** `CONSOLE_URL`: the only other origin an email may link to, in mail for Quad's team. */
  readonly consoleUrl: string;
  /** `SUPPORT_INBOX`: Reply-To for account mail (spec 12). */
  readonly supportInbox: string | null;
}

/** The sending domain when `EMAIL_FROM_DOMAIN` is unset (only allowed with SMTP, so locally). */
const DEFAULT_FROM_DOMAIN = 'mail.quad-edu.com';

export function emailSettingsOf(config: Config): EmailSettings {
  return {
    fromDomain: config.EMAIL_FROM_DOMAIN ?? DEFAULT_FROM_DOMAIN,
    publicWebUrl: config.PUBLIC_WEB_URL,
    consoleUrl: config.CONSOLE_URL,
    supportInbox: config.SUPPORT_INBOX ?? null,
  };
}

/** No line breaks in a header value (a school name could otherwise add headers). */
const oneLine = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim();

/**
 * Renders a job into a message. School mail is From "{School} via Quad" with the school office
 * as Reply-To; account mail is From "Quad" with the support inbox as Reply-To (D19, spec 12),
 * unless its template names the Reply-To (the demo request's sales email: the requester, D57).
 */
export function buildEmailMessage(job: EmailJob, settings: EmailSettings): EmailMessage {
  const school = job.school === null ? null : oneLine(job.school.name);
  const rendered = EMAIL_TEMPLATES[job.template].render(job.params, {
    school,
    publicWebUrl: settings.publicWebUrl,
    consoleUrl: settings.consoleUrl,
  });
  return {
    to: job.to,
    from: {
      name:
        school === null
          ? formatMessage('email.from.account')
          : formatMessage('email.from.school', { school }),
      address: `no-reply@${settings.fromDomain}`,
    },
    replyTo: rendered.replyTo ?? (job.school === null ? settings.supportInbox : job.school.replyTo),
    subject: oneLine(rendered.subject),
    text: rendered.text,
    html: rendered.html,
  };
}

/**
 * Which provider sends email: `EMAIL_PROVIDER` when set; otherwise SMTP when `SMTP_URL` is set
 * (locally, Mailpit); otherwise none, and every send fails.
 */
export function emailProviderOf(config: Config): 'smtp' | 'ses' | null {
  if (config.EMAIL_PROVIDER !== undefined) return config.EMAIL_PROVIDER;
  return config.SMTP_URL === undefined ? null : 'smtp';
}

/** Sends nothing: email is not configured. */
class EmailOff implements EmailTransport {
  send(): Promise<void> {
    return Promise.reject(
      new Error('Email is off: set EMAIL_PROVIDER (smtp or ses) or SMTP_URL to send email.'),
    );
  }
}

/**
 * The configured provider. The adapters load only when chosen, so the API process (which only
 * queues) never loads nodemailer or the AWS SDK.
 */
export async function createEmailTransport(config: Config): Promise<EmailTransport> {
  const provider = emailProviderOf(config);
  if (provider === 'smtp' && config.SMTP_URL !== undefined) {
    const { SmtpEmail } = await import('./smtp-email');
    return new SmtpEmail(config.SMTP_URL);
  }
  if (provider === 'ses' && config.SES_REGION !== undefined) {
    const { createSesEmail } = await import('./ses-email');
    return createSesEmail(config.SES_REGION, config.SES_CONFIGURATION_SET);
  }
  return new EmailOff();
}
