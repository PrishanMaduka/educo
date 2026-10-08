import { describe, expect, it } from 'vitest';

import {
  buildEmailMessage,
  createEmailTransport,
  emailProviderOf,
} from '../../src/common/delivery/email';
import { SesEmail } from '../../src/common/delivery/ses-email';
import { SmtpEmail } from '../../src/common/delivery/smtp-email';
import { loadConfig } from '../../src/config';
import { localEnv } from '../env';

import type { EmailJob } from '../../src/common/delivery/email';

const SETTINGS = {
  fromDomain: 'mail.quad-edu.com',
  publicWebUrl: 'http://localhost:3000',
  supportInbox: 'support@quad-edu.com',
};

const INVITE: EmailJob = {
  to: 'nadeesha.jayasinghe@colombo-intl.local',
  tenantId: '0193e6a1-0000-7000-8000-000000000001',
  school: { name: 'Colombo International School', replyTo: 'office@colombo-intl.local' },
  template: 'staff_invite',
  params: {
    name: 'Nadeesha',
    inviter: 'Prishan Maduka',
    link: 'http://localhost:3000/sign-in/invite/abc.def',
    days: 7,
  },
};

describe('buildEmailMessage', () => {
  it('sends school mail as "{School} via Quad" from no-reply, with the office as Reply-To (D19)', () => {
    const message = buildEmailMessage(INVITE, SETTINGS);
    expect(message.from).toEqual({
      name: 'Colombo International School via Quad',
      address: 'no-reply@mail.quad-edu.com',
    });
    expect(message.replyTo).toBe('office@colombo-intl.local');
    expect(message.to).toBe(INVITE.to);
  });

  it('leaves Reply-To empty when the school has no office email', () => {
    const message = buildEmailMessage(
      { ...INVITE, school: { name: 'Colombo International School', replyTo: null } },
      SETTINGS,
    );
    expect(message.replyTo).toBeNull();
  });

  it('sends account mail as "Quad", with the support inbox as Reply-To', () => {
    const message = buildEmailMessage(
      {
        to: 'prishan.maduka@colombo-intl.local',
        tenantId: null,
        school: null,
        template: 'password_reset',
        params: { link: 'http://localhost:3000/sign-in/reset/abc.def', minutes: 30 },
      },
      SETTINGS,
    );
    expect(message.from).toEqual({ name: 'Quad', address: 'no-reply@mail.quad-edu.com' });
    expect(message.replyTo).toBe('support@quad-edu.com');
  });

  it('keeps line breaks out of the From name', () => {
    const message = buildEmailMessage(
      { ...INVITE, school: { name: 'Colombo\r\nBcc: x@evil.example', replyTo: null } },
      SETTINGS,
    );
    expect(message.from.name).not.toMatch(/[\r\n]/);
  });
});

describe('the SES adapter (fake client; real sends are checked on staging, D19)', () => {
  class FakeSendEmailCommand {
    constructor(readonly input: unknown) {}
  }

  it('sends the raw message through SendEmail with the configuration set', async () => {
    const inputs: unknown[] = [];
    const transport = new SesEmail(
      {
        sesClient: {
          send: (command: unknown) => {
            if (command instanceof FakeSendEmailCommand) inputs.push(command.input);
            return Promise.resolve({ MessageId: '0100018f-test' });
          },
        },
        SendEmailCommand: FakeSendEmailCommand,
      },
      'quad-staging',
    );
    await transport.send(buildEmailMessage(INVITE, SETTINGS));

    expect(inputs).toHaveLength(1);
    const input = inputs[0] as {
      ConfigurationSetName?: string;
      Destination: { ToAddresses: string[] };
      Content: { Raw: { Data: Uint8Array } };
    };
    expect(input.ConfigurationSetName).toBe('quad-staging');
    expect(input.Destination.ToAddresses).toEqual([INVITE.to]);
    const raw = Buffer.from(input.Content.Raw.Data).toString('utf8');
    expect(raw).toMatch(
      /^From: "?Colombo International School via Quad"? <no-reply@mail\.quad-edu\.com>\r$/m,
    );
    expect(raw).toMatch(/^Reply-To: office@colombo-intl\.local\r$/m);
  });
});

describe('choosing the email provider', () => {
  it('uses EMAIL_PROVIDER when set, SMTP when only SMTP_URL is set, and none otherwise', () => {
    expect(emailProviderOf(loadConfig(localEnv({ SMTP_URL: 'smtp://localhost:1025' })))).toBe(
      'smtp',
    );
    expect(
      emailProviderOf(
        loadConfig(
          localEnv({
            EMAIL_PROVIDER: 'ses',
            SES_REGION: 'ap-south-1',
            EMAIL_FROM_DOMAIN: 'mail.quad-edu.com',
          }),
        ),
      ),
    ).toBe('ses');
    expect(emailProviderOf(loadConfig(localEnv()))).toBeNull();
  });

  it('builds the adapter for the provider', async () => {
    expect(
      await createEmailTransport(loadConfig(localEnv({ SMTP_URL: 'smtp://localhost:1025' }))),
    ).toBeInstanceOf(SmtpEmail);
    expect(
      await createEmailTransport(
        loadConfig(
          localEnv({
            EMAIL_PROVIDER: 'ses',
            SES_REGION: 'ap-south-1',
            EMAIL_FROM_DOMAIN: 'mail.quad-edu.com',
          }),
        ),
      ),
    ).toBeInstanceOf(SesEmail);
  });

  it('refuses every send while email is off', async () => {
    const transport = await createEmailTransport(loadConfig(localEnv()));
    await expect(transport.send(buildEmailMessage(INVITE, SETTINGS))).rejects.toThrow(
      /EMAIL_PROVIDER/,
    );
  });
});
