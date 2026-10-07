import { X509Certificate, createPublicKey } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cachedKeyGetter,
  canonicalSnsString,
  confirmSnsSubscription,
  fetchSnsSigningKey,
  isAwsSnsUrl,
  isFreshSnsTimestamp,
  isSigningCertForTopic,
  isSnsUrlForTopic,
  parseSnsCertificate,
  verifySnsSignature,
} from '../../src/webhooks/ses/sns-signature';

import {
  TEST_CERT_URL,
  TEST_TOPIC_ARN,
  confirmation,
  envelope,
  makeSigningCert,
  makeSigningKey,
  signEnvelope,
} from './sns-fixtures';

import type { KeyObject } from 'node:crypto';

const cert = makeSigningCert();
const certKey = createPublicKey(cert.certPem);
const getKey = (): Promise<KeyObject | null> => Promise.resolve(certKey);
const x509 = new X509Certificate(cert.certPem);
const validFrom = Date.parse(x509.validFrom);
const validTo = Date.parse(x509.validTo);
const now = validFrom + 60_000;

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
  it('accepts a message signed by the certificate key', async () => {
    const signed = signEnvelope(envelope(), cert.privateKey);
    await expect(verifySnsSignature(signed, getKey)).resolves.toBe(true);
  });

  it('accepts a signed subscription confirmation', async () => {
    const signed = signEnvelope(confirmation(), cert.privateKey);
    await expect(verifySnsSignature(signed, getKey)).resolves.toBe(true);
  });

  it('refuses a message whose Message changed after signing', async () => {
    const signed = signEnvelope(envelope({ Message: 'a' }), cert.privateKey);
    await expect(verifySnsSignature({ ...signed, Message: 'b' }, getKey)).resolves.toBe(false);
  });

  it('refuses a message signed with another key', async () => {
    const signed = signEnvelope(envelope(), makeSigningKey().privateKey);
    await expect(verifySnsSignature(signed, getKey)).resolves.toBe(false);
  });

  it('refuses SignatureVersion 1 without fetching the key', async () => {
    const fetchKey = vi.fn(getKey);
    const signed = signEnvelope(envelope({ SignatureVersion: '1' }), cert.privateKey);
    await expect(verifySnsSignature(signed, fetchKey)).resolves.toBe(false);
    expect(fetchKey).not.toHaveBeenCalled();
  });

  it('refuses a confirmation without SubscribeURL or Token', async () => {
    const signed = signEnvelope(confirmation(), cert.privateKey);
    await expect(verifySnsSignature({ ...signed, Token: undefined }, getKey)).resolves.toBe(false);
    await expect(verifySnsSignature({ ...signed, SubscribeURL: undefined }, getKey)).resolves.toBe(
      false,
    );
  });

  it('refuses a SigningCertURL that is not the pinned certificate URL, without fetching it', async () => {
    const fetchKey = vi.fn(getKey);
    for (const url of [
      'https://evil.io/x.pem',
      'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-0123456789abcdef0123456789abcdef.pem',
      `${TEST_CERT_URL}?x=1`,
    ]) {
      const signed = signEnvelope(envelope({ SigningCertURL: url }), cert.privateKey);
      await expect(verifySnsSignature(signed, fetchKey)).resolves.toBe(false);
    }
    expect(fetchKey).not.toHaveBeenCalled();
  });

  it('refuses when the key getter finds no usable certificate', async () => {
    const signed = signEnvelope(envelope(), cert.privateKey);
    await expect(verifySnsSignature(signed, () => Promise.resolve(null))).resolves.toBe(false);
  });

  it('asks for the key at the message SigningCertURL', async () => {
    const fetchKey = vi.fn(getKey);
    await verifySnsSignature(signEnvelope(envelope(), cert.privateKey), fetchKey);
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

describe('isSnsUrlForTopic (SubscribeURL)', () => {
  it.each([
    ['https://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription&Token=t', true],
    ['https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&Token=t', false],
    ['https://evil.io/?Action=ConfirmSubscription', false],
    ['http://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription', false],
  ])('%s → %s', (url, expected) => {
    expect(isSnsUrlForTopic(url, TEST_TOPIC_ARN)).toBe(expected);
  });

  it('is false for a topic that is not an SNS ARN', () => {
    expect(isSnsUrlForTopic('https://sns.ap-south-1.amazonaws.com/', 'nope')).toBe(false);
  });
});

describe('isSigningCertForTopic', () => {
  const base = 'https://sns.ap-south-1.amazonaws.com';
  const file = 'SimpleNotificationService-0123456789abcdef0123456789abcdef.pem';

  it.each([
    [`${base}/${file}`, true],
    [`https://sns.us-east-1.amazonaws.com/${file}`, false],
    [`https://sns.ap-south-1.amazonaws.com.evil.io/${file}`, false],
    [`http://sns.ap-south-1.amazonaws.com/${file}`, false],
    [`${base}/${file}?x=1`, false],
    [`${base}/${file}?`, false],
    [`${base}/${file}#frag`, false],
    [`${base}/${file}#`, false],
    [`${base}/SimpleNotificationService-0123456789abcdef0123456789abcdef.txt`, false],
    [`${base}/SimpleNotificationService-0123456789ABCDEF0123456789ABCDEF.pem`, false],
    [`${base}/SimpleNotificationService-0123.pem`, false],
    [`${base}/x/${file}`, false],
    [`${base}/x.pem`, false],
    [`${base}/`, false],
  ])('%s → %s', (url, expected) => {
    expect(isSigningCertForTopic(url, TEST_TOPIC_ARN)).toBe(expected);
  });
});

describe('parseSnsCertificate', () => {
  it('returns the public key of a single valid certificate', () => {
    const key = parseSnsCertificate(cert.certPem, now);
    expect(key?.equals(certKey)).toBe(true);
  });

  it('accepts CRLF line endings and no trailing newline', () => {
    const crlf = cert.certPem.trimEnd().replace(/\n/g, '\r\n');
    expect(parseSnsCertificate(crlf, now)).not.toBeNull();
  });

  it.each([
    ['text before the PEM block', (pem: string) => `hello\n${pem}`],
    ['text after the PEM block', (pem: string) => `${pem}trailing text\n`],
    ['two certificates', (pem: string) => `${pem}${pem}`],
    [
      'a public key instead of a certificate',
      () => certKey.export({ type: 'spki', format: 'pem' }).toString(),
    ],
    [
      'a damaged certificate',
      (pem: string) => pem.replace(/[A-Za-z](?=[A-Za-z0-9+/=]*\n-----END)/, '!'),
    ],
    ['an empty body', () => ''],
  ])('refuses %s', (_name, mutate) => {
    expect(parseSnsCertificate(mutate(cert.certPem), now)).toBeNull();
  });

  it('refuses an expired certificate and one that is not yet valid', () => {
    expect(parseSnsCertificate(cert.certPem, validTo + 1000)).toBeNull();
    expect(parseSnsCertificate(cert.certPem, validFrom - 1000)).toBeNull();
    expect(parseSnsCertificate(cert.certPem, validTo - 1000)).not.toBeNull();
  });
});

describe('isFreshSnsTimestamp', () => {
  const at = Date.parse('2026-10-07T12:00:00.000Z');

  it.each([
    ['2026-10-07T12:00:00.000Z', true],
    ['2026-10-07T11:00:00.000Z', true],
    ['2026-10-07T10:59:59.999Z', false],
    ['2026-10-07T12:05:00.000Z', true],
    ['2026-10-07T12:05:00.001Z', false],
    ['not a date', false],
  ])('%s → %s', (timestamp, expected) => {
    expect(isFreshSnsTimestamp(timestamp, at)).toBe(expected);
  });
});

describe('cachedKeyGetter', () => {
  it('fetches each URL once within 24 hours, then again after', async () => {
    let clock = 0;
    const fetchKey = vi.fn(getKey);
    const get = cachedKeyGetter(fetchKey, () => clock);
    expect(await get('https://a')).toBe(certKey);
    clock += 24 * 60 * 60 * 1000 - 1;
    await get('https://a');
    expect(fetchKey).toHaveBeenCalledTimes(1);
    clock += 1;
    await get('https://a');
    expect(fetchKey).toHaveBeenCalledTimes(2);
  });

  it('keeps at most 10 entries, dropping the oldest', async () => {
    const fetchKey = vi.fn(getKey);
    const get = cachedKeyGetter(fetchKey, () => 0);
    for (let i = 0; i <= 10; i += 1) await get(`https://k${i}`);
    expect(fetchKey).toHaveBeenCalledTimes(11);
    await get('https://k10');
    expect(fetchKey).toHaveBeenCalledTimes(11);
    await get('https://k0');
    expect(fetchKey).toHaveBeenCalledTimes(12);
  });

  it('caches neither a failed fetch nor a missing key', async () => {
    const fetchKey = vi
      .fn<(url: string) => Promise<KeyObject | null>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(certKey);
    const get = cachedKeyGetter(fetchKey, () => 0);
    await expect(get('https://a')).rejects.toThrow('down');
    await expect(get('https://a')).resolves.toBeNull();
    await expect(get('https://a')).resolves.toBe(certKey);
  });
});

describe('fetchSnsSigningKey (fetch is stubbed; nothing reaches the network)', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  afterEach(() => {
    fetchSpy.mockReset();
  });
  const clock = () => now;

  it('returns the certificate public key, without following redirects', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(cert.certPem));
    const key = await fetchSnsSigningKey(TEST_CERT_URL, clock);
    expect(key?.equals(certKey)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      TEST_CERT_URL,
      expect.objectContaining({ redirect: 'error' }),
    );
  });

  it('returns null (not verified) for a 4xx answer', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('missing', { status: 404 }));
    await expect(fetchSnsSigningKey(TEST_CERT_URL, clock)).resolves.toBeNull();
  });

  it('throws for a 5xx answer or a network error, so SNS retries', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('oops', { status: 503 }));
    await expect(fetchSnsSigningKey(TEST_CERT_URL, clock)).rejects.toThrow(/503/);
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(fetchSnsSigningKey(TEST_CERT_URL, clock)).rejects.toThrow(/fetch failed/);
  });

  it('returns null for a body that is not exactly one valid certificate', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(`<html>${cert.certPem}</html>`));
    await expect(fetchSnsSigningKey(TEST_CERT_URL, clock)).resolves.toBeNull();
    fetchSpy.mockResolvedValueOnce(new Response(cert.certPem));
    await expect(fetchSnsSigningKey(TEST_CERT_URL, () => validTo + 1000)).resolves.toBeNull();
  });

  it('refuses a declared content-length over 16 KB without reading the body', async () => {
    const body = new ReadableStream<Uint8Array>({
      pull: () => {
        throw new Error('the body must not be read');
      },
    });
    fetchSpy.mockResolvedValueOnce(
      new Response(body, { headers: { 'content-length': String(1024 * 1024) } }),
    );
    await expect(fetchSnsSigningKey(TEST_CERT_URL, clock)).resolves.toBeNull();
  });

  it('stops reading a body without content-length once it passes 16 KB', async () => {
    let chunks = 0;
    const body = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        chunks += 1;
        controller.enqueue(new Uint8Array(4096).fill(65));
      },
    });
    fetchSpy.mockResolvedValueOnce(new Response(body));
    await expect(fetchSnsSigningKey(TEST_CERT_URL, clock)).resolves.toBeNull();
    expect(chunks).toBeLessThanOrEqual(6);
  });

  it('refuses a URL that is not the pinned certificate URL before any request', async () => {
    await expect(fetchSnsSigningKey('https://evil.io/x.pem', clock)).rejects.toThrow(
      /not an AWS SNS/,
    );
    await expect(confirmSnsSubscription('http://sns.ap-south-1.amazonaws.com/')).rejects.toThrow(
      /not an AWS SNS/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
