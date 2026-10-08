import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { createTransport } from 'nodemailer';

import { mailOptionsOf } from './smtp-email';

import type { EmailMessage, EmailTransport } from './email';
import type { Transporter } from 'nodemailer';
import type SESTransport from 'nodemailer/lib/ses-transport';

/** What nodemailer's SES transport needs from `@aws-sdk/client-sesv2`; tests pass fakes. */
export type SesParts = SESTransport.Options['SES'];

/**
 * Amazon SES v2 (D19): nodemailer builds the raw MIME message and SES sends it, tagged with the
 * configuration set whose bounce and complaint events reach the SES webhook. Real sends are
 * checked on staging; tests use a fake client.
 */
export class SesEmail implements EmailTransport {
  private readonly transporter: Transporter;

  constructor(
    parts: SesParts,
    private readonly configurationSet: string | undefined,
  ) {
    this.transporter = createTransport({ SES: parts });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      ...mailOptionsOf(message),
      ...(this.configurationSet === undefined
        ? {}
        : { ses: { ConfigurationSetName: this.configurationSet } }),
    });
  }
}

/** The SES adapter on the task role's credentials (the default AWS credential chain). */
export function createSesEmail(region: string, configurationSet: string | undefined): SesEmail {
  return new SesEmail(
    { sesClient: new SESv2Client({ region }), SendEmailCommand },
    configurationSet,
  );
}
