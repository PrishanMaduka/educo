import { createTransport } from 'nodemailer';

import type { EmailMessage, EmailTransport } from './email';
import type { Transporter } from 'nodemailer';

/** Fields every nodemailer transport takes, from our message. */
export function mailOptionsOf(message: EmailMessage): {
  from: { name: string; address: string };
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
} {
  return {
    from: { name: message.from.name, address: message.from.address },
    to: message.to,
    ...(message.replyTo === null ? {} : { replyTo: message.replyTo }),
    subject: message.subject,
    text: message.text,
    html: message.html,
  };
}

/** SMTP through nodemailer: Mailpit locally (`smtp://localhost:1025`). */
export class SmtpEmail implements EmailTransport {
  private readonly transporter: Transporter;

  constructor(smtpUrl: string) {
    this.transporter = createTransport(smtpUrl);
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail(mailOptionsOf(message));
  }
}
