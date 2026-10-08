import { randomBytes } from 'node:crypto';

import { createTestDatabase } from '@quad/db/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseSnsCertificate } from '../../src/webhooks/ses/sns-signature';
import { useTestApp } from '../app';

import {
  TEST_TOPIC_ARN,
  confirmation,
  envelope,
  makeSigningCert,
  makeSigningKey,
  signEnvelope,
} from './sns-fixtures';

import type { SnsEnvelope } from '@quad/contracts';
import type { TestDatabase } from '@quad/db/testing';
import type { KeyObject } from 'node:crypto';

const keys = makeSigningCert();
/**
 * The app's injected clock: fixed, so the replay window is tested against a known now. Taken
 * after the certificate exists: its notBefore is the creation second, which can be later than
 * a clock read just before it.
 */
const NOW = Date.now();
// Never the network: the certificate's key and the SubscribeURL GET are injected.
const fetchKey = vi.fn<(certUrl: string) => Promise<KeyObject | null>>(() =>
  Promise.resolve(parseSnsCertificate(keys.certPem, NOW)),
);
const subscribe = vi.fn<(url: string) => Promise<void>>(() => Promise.resolve());

let db: TestDatabase | undefined;
const testDb = (): TestDatabase => {
  if (!db) throw new Error('The test database is not ready.');
  return db;
};
beforeAll(async () => {
  db = await createTestDatabase();
});
// afterAll hooks run in reverse order, so the app below closes its pool before this drop.
afterAll(async () => {
  await db?.drop();
});
// Registered after the database hooks, so the app boots against the fresh database.
const app = useTestApp(
  () => ({
    DATABASE_URL: testDb().appUrl,
    DATABASE_PLATFORM_URL: testDb().platformUrl,
    SES_SNS_TOPIC_ARN: TEST_TOPIC_ARN,
  }),
  { overrides: { now: () => NOW, snsFetchers: { key: fetchKey, subscribe } } },
);

beforeEach(async () => {
  fetchKey.mockClear();
  subscribe.mockClear();
  await testDb().owner.query('delete from email_suppressions');
});

async function post(body: string, contentType = 'text/plain; charset=UTF-8') {
  return app()
    .getHttpAdapter()
    .getInstance()
    .inject({
      method: 'POST',
      url: '/api/v1/webhooks/ses',
      headers: { 'content-type': contentType, 'x-amz-sns-message-type': 'Notification' },
      payload: body,
    });
}

const postSigned = (message: SnsEnvelope, contentType?: string) =>
  post(JSON.stringify(signEnvelope(message, keys.privateKey)), contentType);

const at = (offsetMs: number): string => new Date(NOW + offsetMs).toISOString();
const sesEvent = (event: unknown): SnsEnvelope =>
  envelope({ Message: JSON.stringify(event), Timestamp: at(0) });

/** A certificate URL no earlier test used, so the key cache cannot answer for it. */
const uncachedCertUrl = (): string =>
  `https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-${randomBytes(16).toString('hex')}.pem`;

const permanentBounce = (address: string) =>
  sesEvent({
    eventType: 'Bounce',
    bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: address }] },
    mail: { messageId: 'ses-1' },
  });

async function suppressions(): Promise<{ address: string; reason: string; source: string }[]> {
  const { rows } = await testDb().owner.query<{ address: string; reason: string; source: string }>(
    'select address::text, reason::text, source from email_suppressions order by address',
  );
  return rows;
}

describe('POST /webhooks/ses: SES events', () => {
  it('records a permanent bounce as reason bounce, source ses', async () => {
    const response = await postSigned(permanentBounce('a@example.com'));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(await suppressions()).toEqual([
      { address: 'a@example.com', reason: 'bounce', source: 'ses' },
    ]);
  });

  it('keeps one row when the same notification is delivered again', async () => {
    const signed = JSON.stringify(signEnvelope(permanentBounce('a@example.com'), keys.privateKey));
    expect((await post(signed)).statusCode).toBe(200);
    expect((await post(signed)).statusCode).toBe(200);
    expect(await suppressions()).toHaveLength(1);
  });

  it('changes the reason to complaint when the address later complains', async () => {
    await postSigned(permanentBounce('a@example.com'));
    const response = await postSigned(
      sesEvent({
        notificationType: 'Complaint',
        complaint: { complainedRecipients: [{ emailAddress: 'a@example.com' }] },
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(await suppressions()).toEqual([
      { address: 'a@example.com', reason: 'complaint', source: 'ses' },
    ]);
  });

  it('accepts application/json as well as text/plain', async () => {
    const response = await postSigned(permanentBounce('j@example.com'), 'application/json');
    expect(response.statusCode).toBe(200);
    expect(await suppressions()).toHaveLength(1);
  });

  it('writes nothing for a transient bounce', async () => {
    const response = await postSigned(
      sesEvent({
        eventType: 'Bounce',
        bounce: { bounceType: 'Transient', bouncedRecipients: [{ emailAddress: 'a@example.com' }] },
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(await suppressions()).toEqual([]);
  });

  it('writes nothing for another event or a Message that is not an SES event', async () => {
    expect((await postSigned(sesEvent({ eventType: 'Delivery' }))).statusCode).toBe(200);
    expect((await postSigned(envelope({ Message: 'plain text' }))).statusCode).toBe(200);
    expect(await suppressions()).toEqual([]);
  });
});

describe('POST /webhooks/ses: subscription', () => {
  it('confirms a subscription from the configured topic by fetching SubscribeURL once', async () => {
    const message = confirmation();
    const response = await postSigned(message);
    expect(response.statusCode).toBe(200);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(message.SubscribeURL);
  });

  it('refuses a signed confirmation whose SubscribeURL is not an AWS SNS host', async () => {
    const response = await postSigned(confirmation({ SubscribeURL: 'https://evil.io/confirm' }));
    expect(response.statusCode).toBe(403);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('refuses a signed confirmation whose SubscribeURL is in another region', async () => {
    const response = await postSigned(
      confirmation({
        SubscribeURL: 'https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&Token=t',
      }),
    );
    expect(response.statusCode).toBe(403);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('acknowledges an unsubscribe confirmation without fetching anything', async () => {
    const response = await postSigned(confirmation({ Type: 'UnsubscribeConfirmation' }));
    expect(response.statusCode).toBe(200);
    expect(subscribe).not.toHaveBeenCalled();
  });
});

// Review Focus #3: correctly signed messages we did not ask for.
describe('POST /webhooks/ses: refusals (403, nothing fetched, nothing written)', () => {
  it.each<[string, SnsEnvelope]>([
    [
      'a confirmation from another topic',
      confirmation({ TopicArn: 'arn:aws:sns:ap-south-1:123456789012:someone-else' }),
    ],
    [
      'a bounce from another topic',
      { ...permanentBounce('a@example.com'), TopicArn: 'arn:aws:sns:ap-south-1:999999999999:x' },
    ],
    [
      'a SigningCertURL on a non-AWS host',
      confirmation({ SigningCertURL: 'https://sns.ap-south-1.amazonaws.com.evil.io/x.pem' }),
    ],
    [
      'a SigningCertURL in another region than the topic',
      confirmation({ SigningCertURL: 'https://sns.us-east-1.amazonaws.com/x.pem' }),
    ],
    ['SignatureVersion 1', confirmation({ SignatureVersion: '1' })],
    [
      'SignatureVersion 1 on a bounce',
      { ...permanentBounce('a@example.com'), SignatureVersion: '1' },
    ],
    [
      'a message older than an hour (replay)',
      { ...permanentBounce('a@example.com'), Timestamp: at(-3_600_001) },
    ],
    [
      'a message more than five minutes in the future',
      { ...permanentBounce('a@example.com'), Timestamp: at(300_001) },
    ],
    [
      'a SigningCertURL with a query string',
      {
        ...permanentBounce('a@example.com'),
        SigningCertURL:
          'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-0123456789abcdef0123456789abcdef.pem?x=1',
      },
    ],
  ])('%s', async (_name, message) => {
    const response = await postSigned(message);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
    expect(fetchKey).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(await suppressions()).toEqual([]);
  });

  it('refuses a bad signature after fetching only the AWS key', async () => {
    const signed = signEnvelope(permanentBounce('a@example.com'), keys.privateKey);
    const response = await post(
      JSON.stringify({ ...signed, Message: '{"eventType":"Complaint"}' }),
    );
    expect(response.statusCode).toBe(403);
    expect(subscribe).not.toHaveBeenCalled();
    expect(await suppressions()).toEqual([]);
  });

  it('refuses a confirmation signed with another key without fetching SubscribeURL', async () => {
    const response = await post(
      JSON.stringify(signEnvelope(confirmation(), makeSigningKey().privateKey)),
    );
    expect(response.statusCode).toBe(403);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('refuses when AWS has no usable certificate at the URL (4xx or invalid), writing nothing', async () => {
    fetchKey.mockResolvedValueOnce(null);
    const response = await postSigned({
      ...permanentBounce('a@example.com'),
      SigningCertURL: uncachedCertUrl(),
    });
    expect(fetchKey).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(403);
    expect(await suppressions()).toEqual([]);
  });

  it('answers 500 when the certificate download fails, so SNS retries', async () => {
    fetchKey.mockRejectedValueOnce(new Error('SNS answered 503'));
    const response = await postSigned({
      ...permanentBounce('a@example.com'),
      SigningCertURL: uncachedCertUrl(),
    });
    expect(fetchKey).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(500);
    expect(await suppressions()).toEqual([]);
  });

  it('refuses a body over 300 KB with 413 before parsing it', async () => {
    const response = await post('x'.repeat(301 * 1024));
    expect(response.statusCode).toBe(413);
    expect(fetchKey).not.toHaveBeenCalled();
  });

  it('refuses a message without a signature', async () => {
    // JSON.stringify leaves out undefined, so the body has no Signature at all.
    const response = await post(
      JSON.stringify({ ...permanentBounce('a@example.com'), Signature: undefined }),
    );
    expect(response.statusCode).toBe(403);
    expect(await suppressions()).toEqual([]);
  });

  it('answers 400 validation for a body that is not JSON', async () => {
    const response = await post('this is not json');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });
});

describe('tenant-less (D16)', () => {
  it('quad_app cannot read email_suppressions; it can only call the definer function', async () => {
    await expect(testDb().app.query('select * from email_suppressions')).rejects.toThrow(
      /permission denied/,
    );
  });
});
