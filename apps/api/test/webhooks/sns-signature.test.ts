import { describe, expect, it, vi } from 'vitest';

import {
  cachedKeyGetter,
  canonicalSnsString,
  confirmSnsSubscription,
  fetchSnsSigningKey,
  isAwsSnsUrl,
  isFreshSnsTimestamp,
  isSigningCertForTopic,
  verifySnsSignature,
} from '../../src/webhooks/ses/sns-signature';

import {
  TEST_CERT_URL,
  confirmation,
  envelope,
  makeSigningKey,
  signEnvelope,
} from './sns-fixtures';

const keys = makeSigningKey();
const getKey = (): Promise<string> => Promise.resolve(keys.publicKey);

describe('canonicalSnsString', () => {
  it('writes a Notification as key\\nvalue\\n in the AWS order, with Subject when present', () => {
    const message = envelope({
      Message: 'm',
      MessageId: 'id',
      Subject: 's',
      Timestamp: '2026-10-07T10:00:00.000Z',
      TopicArn: 'arn',
    });
    expect(canonicalSnsString(message)).toBe(
      'Message\nm\nMessageId\nid\nSubject\ns\nTimestamp\n2026-10-07T10:00:00.000Z\nTopicArn\narn\nType\nNotification\n',
    );
    expect(canonicalSnsString({ ...message, Subject: undefined })).not.toContain('Subject');
  });

  it('writes a confirmation with SubscribeURL and Token, and never Subject', () => {
    const message = confirmation({
      Message: 'm',
      MessageId: 'id',
      SubscribeURL: 'u',
      Token: 't',
      Timestamp: 'ts',
      TopicArn: 'arn',
      Subject: 'ignored',
    });
    expect(canonicalSnsString(message)).toBe(
      'Message\nm\nMessageId\nid\nSubscribeURL\nu\nTimestamp\nts\nToken\nt\nTopicArn\narn\nType\nSubscriptionConfirmation\n',
    );
  });
});

describe('verifySnsSignature', () => {
  it('accepts a message signed with the matching key', async () => {
    await expect(
      verifySnsSignature(signEnvelope(envelope(), keys.privateKey), getKey),
    ).resolves.toBe(true);
  });

  it('accepts a signed subscription confirmation', async () => {
    const signed = signEnvelope(confirmation(), keys.privateKey);
    await expect(verifySnsSignature(signed, getKey)).resolves.toBe(true);
  });

  it('refuses a message whose Message changed after signing', async () => {
    const signed = signEnvelope(envelope({ Message: 'a' }), keys.privateKey);
    await expect(verifySnsSignature({ ...signed, Message: 'b' }, getKey)).resolves.toBe(false);
  });

  it('refuses a message signed with another key', async () => {
    const signed = signEnvelope(envelope(), makeSigningKey().privateKey);
    await expect(verifySnsSignature(signed, getKey)).resolves.toBe(false);
  });

  it('refuses SignatureVersion 1 without fetching the key', async () => {
    const fetchKey = vi.fn(getKey);
    const signed = signEnvelope(envelope({ SignatureVersion: '1' }), keys.privateKey);
    await expect(verifySnsSignature(signed, fetchKey)).resolves.toBe(false);
    expect(fetchKey).not.toHaveBeenCalled();
  });

  it('refuses a confirmation without SubscribeURL or Token', async () => {
    const signed = signEnvelope(confirmation(), keys.privateKey);
    await expect(verifySnsSignature({ ...signed, Token: undefined }, getKey)).resolves.toBe(false);
    await expect(verifySnsSignature({ ...signed, SubscribeURL: undefined }, getKey)).resolves.toBe(
      false,
    );
  });

  it('refuses a non-AWS SigningCertURL without fetching it', async () => {
    const fetchKey = vi.fn(getKey);
    const signed = signEnvelope(
      envelope({ SigningCertURL: 'https://evil.io/x.pem' }),
      keys.privateKey,
    );
    await expect(verifySnsSignature(signed, fetchKey)).resolves.toBe(false);
    expect(fetchKey).not.toHaveBeenCalled();
  });

  it('refuses a key that is not a PEM key or certificate', async () => {
    const signed = signEnvelope(envelope(), keys.privateKey);
    await expect(verifySnsSignature(signed, () => Promise.resolve('not a key'))).resolves.toBe(
      false,
    );
  });

  it('asks for the key at the message SigningCertURL', async () => {
    const fetchKey = vi.fn(getKey);
    await verifySnsSignature(signEnvelope(envelope(), keys.privateKey), fetchKey);
    expect(fetchKey).toHaveBeenCalledWith(TEST_CERT_URL);
  });
});

describe('isAwsSnsUrl', () => {
  it.each([
    ['https://sns.ap-south-1.amazonaws.com/x.pem', true],
    ['https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription', true],
    ['http://sns.ap-south-1.amazonaws.com/x.pem', false],
    ['https://sns.ap-south-1.amazonaws.com.evil.io/x.pem', false],
    ['https://evil.io/', false],
    ['https://sns.amazonaws.com/x.pem', false],
    ['https://evil.sns.ap-south-1.amazonaws.com/x.pem', false],
    ['https://user:pass@sns.ap-south-1.amazonaws.com/x.pem', false],
    ['https://sns.ap-south-1.amazonaws.com:8443/x.pem', false],
    ['not a url', false],
  ])('%s → %s', (url, expected) => {
    expect(isAwsSnsUrl(url)).toBe(expected);
  });
});

describe('cachedKeyGetter', () => {
  it('fetches each URL once within 24 hours, then again after', async () => {
    let now = 0;
    const fetchKey = vi.fn((url: string) => Promise.resolve(`key for ${url}`));
    const get = cachedKeyGetter(fetchKey, () => now);
    expect(await get('https://a')).toBe('key for https://a');
    now += 24 * 60 * 60 * 1000 - 1;
    await get('https://a');
    expect(fetchKey).toHaveBeenCalledTimes(1);
    now += 1;
    await get('https://a');
    expect(fetchKey).toHaveBeenCalledTimes(2);
  });

  it('keeps at most 10 entries, dropping the oldest', async () => {
    const fetchKey = vi.fn((url: string) => Promise.resolve(url));
    const get = cachedKeyGetter(fetchKey, () => 0);
    for (let i = 0; i <= 10; i += 1) await get(`https://k${i}`);
    expect(fetchKey).toHaveBeenCalledTimes(11);
    await get('https://k10');
    expect(fetchKey).toHaveBeenCalledTimes(11);
    await get('https://k0');
    expect(fetchKey).toHaveBeenCalledTimes(12);
  });

  it('does not cache a failed fetch', async () => {
    const fetchKey = vi
      .fn<(url: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce('key');
    const get = cachedKeyGetter(fetchKey, () => 0);
    await expect(get('https://a')).rejects.toThrow('down');
    await expect(get('https://a')).resolves.toBe('key');
  });
});

describe('isSigningCertForTopic', () => {
  const topic = 'arn:aws:sns:ap-south-1:123456789012:quad-staging-ses-events';

  it.each([
    ['https://sns.ap-south-1.amazonaws.com/x.pem', true],
    ['https://sns.us-east-1.amazonaws.com/x.pem', false],
    ['https://sns.ap-south-1.amazonaws.com.evil.io/x.pem', false],
    ['http://sns.ap-south-1.amazonaws.com/x.pem', false],
  ])('%s → %s', (url, expected) => {
    expect(isSigningCertForTopic(url, topic)).toBe(expected);
  });

  it('is false for a topic that is not an SNS ARN', () => {
    expect(isSigningCertForTopic('https://sns.ap-south-1.amazonaws.com/x.pem', 'nope')).toBe(false);
  });
});

describe('isFreshSnsTimestamp', () => {
  const now = Date.parse('2026-10-07T12:00:00.000Z');

  it.each([
    ['2026-10-07T12:00:00.000Z', true],
    ['2026-10-07T11:00:00.000Z', true],
    ['2026-10-07T10:59:59.999Z', false],
    ['2026-10-07T12:05:00.000Z', true],
    ['2026-10-07T12:05:00.001Z', false],
    ['not a date', false],
  ])('%s → %s', (timestamp, expected) => {
    expect(isFreshSnsTimestamp(timestamp, now)).toBe(expected);
  });
});

describe('the default fetchers', () => {
  it('refuse a URL that is not an AWS SNS host before any request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      await expect(fetchSnsSigningKey('https://evil.io/x.pem')).rejects.toThrow(/not an AWS SNS/);
      await expect(confirmSnsSubscription('http://sns.ap-south-1.amazonaws.com/')).rejects.toThrow(
        /not an AWS SNS/,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
